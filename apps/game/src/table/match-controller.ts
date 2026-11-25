// Orquesta una partida (ADR-0004 §2 y §5): acciones con idempotencia y versión, turno de 30 s con
// la acción por tiempo agotado del motor, bots con retardo «humano», pausa entre manos (D19),
// pausa sin humanos (D20) y fin. Sin Colyseus: el tiempo, el azar y la salida se inyectan.
import { decideAction, type BotPersona } from '@31mus/bots';
import {
  applyAction,
  createMatch,
  getLegalActions,
  getTimeoutAction,
  getView,
  pendingSeats,
  perSeat,
  startNextHand,
  type Action,
  type GameEvent,
  type MatchConfig,
  type MatchState,
  type MusErrorCode,
  type Seat,
} from '@31mus/engine';
import {
  ACTION_ID_MEMORY,
  type ActionErrorCode,
  type ActionResultMessage,
  type GameActionMessage,
} from '@31mus/shared';

import type { TimerHandle } from '../infra/scheduler.js';
import type { MatchSnapshot } from './outbound.js';
import {
  ActionMemory,
  type Actor,
  type MatchControllerDeps,
  type MatchStatus,
} from './match-types.js';
import { TurnTimers } from './turn-timers.js';

export type {
  Actor,
  MatchControllerDeps,
  MatchStatus,
  MatchTiming,
  SeatControl,
  StepRecord,
} from './match-types.js';

const ENGINE_TO_ACTION_ERROR: Readonly<Record<MusErrorCode, ActionErrorCode>> = {
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  ILLEGAL_ACTION: 'ILLEGAL_ACTION',
  HAND_NOT_OVER: 'MATCH_NOT_RUNNING',
  MATCH_OVER: 'MATCH_NOT_RUNNING',
};

export class MatchController {
  private matchState: MatchState | null = null;
  private current: MatchStatus = 'idle';
  private version = 0;
  private readonly turns: TurnTimers;
  private nextHandTimer: TimerHandle | null = null;
  private readonly results = new ActionMemory(ACTION_ID_MEMORY);

  constructor(private readonly deps: MatchControllerDeps) {
    this.turns = new TurnTimers({
      scheduler: deps.scheduler,
      rng: deps.rng,
      turnMs: deps.timing.turnMs,
      botDelayMinMs: deps.timing.botDelayMinMs,
      botDelayMaxMs: deps.timing.botDelayMaxMs,
      onTimeout: (seat) => {
        this.guard('tiempo agotado', () => {
          this.onTimeout(seat);
        });
      },
      onBotTurn: (seat, persona) => {
        this.guard('turno de bot', () => {
          this.onBotTurn(seat, persona);
        });
      },
    });
  }

  get status(): MatchStatus {
    return this.current;
  }

  /** Reparte la primera mano y arma los turnos. */
  start(config: MatchConfig = {}): void {
    if (this.current !== 'idle') return;
    this.matchState = createMatch(config, this.deps.rng);
    this.current = 'playing';
    this.commit([], { by: 'system' }, null, null, false);
  }

  /** Estado actual para quien entra o vuelve a mitad de partida (sin eventos). */
  snapshot(): MatchSnapshot | null {
    if (this.matchState === null) return null;
    return {
      version: this.version,
      state: this.matchState,
      events: [],
      deadlines: perSeat((seat) => this.turns.deadline(seat)),
      running: this.current === 'playing',
    };
  }

  /**
   * Acción de un humano. Un `actionId` repetido devuelve la misma respuesta sin aplicar nada
   * (idempotencia, CLAUDE.md §11); una `version` distinta de la actual se rechaza.
   */
  act(seat: Seat, message: GameActionMessage): ActionResultMessage {
    const remembered = this.results.get(seat, message.actionId);
    if (remembered !== undefined) return remembered;
    const code = this.tryHumanAction(seat, message);
    const result: ActionResultMessage =
      code === null
        ? { actionId: message.actionId, ok: true }
        : { actionId: message.actionId, ok: false, code };
    this.results.set(seat, result);
    return result;
  }

  /** El control de un asiento cambió (se fue o volvió su humano). */
  controlChanged(seat: Seat): void {
    const control = this.deps.control(seat);
    if (control.kind === 'bot') this.turns.botTookOver(seat, control.persona);
  }

  /** Sin humanos conectados (D20): se paran turnos, bots y reparto. */
  pause(): void {
    if (this.current !== 'playing') return;
    this.current = 'paused';
    this.clearTimers();
    this.publish([]);
  }

  /** Vuelve un humano: turnos nuevos con el tiempo completo. */
  resume(): void {
    if (this.current !== 'paused') return;
    this.current = 'playing';
    this.armAfterChange(null, false);
    this.publish([]);
  }

  /** Detiene todos los temporizadores (al cerrar la sala). */
  dispose(): void {
    this.clearTimers();
  }

  private tryHumanAction(seat: Seat, message: GameActionMessage): ActionErrorCode | null {
    if (this.current !== 'playing') return 'MATCH_NOT_RUNNING';
    if (message.version !== this.version) return 'STALE_VERSION';
    const error = this.apply(seat, message.action, { seat, by: 'human' });
    return error === null ? null : ENGINE_TO_ACTION_ERROR[error];
  }

  private apply(seat: Seat, action: Action, actor: Actor): MusErrorCode | null {
    const before = this.state();
    const result = applyAction(before, seat, action, { rng: this.deps.rng });
    if (!result.ok) return result.error.code;
    this.matchState = result.value.state;
    const keep =
      before.hand.number === result.value.state.hand.number &&
      before.hand.phase.kind === 'discard' &&
      result.value.state.hand.phase.kind === 'discard';
    this.commit(result.value.events, actor, action, seat, keep);
    return null;
  }

  /** Tras cada cambio: versión, log, turnos o siguiente mano o fin, y publicación. */
  private commit(
    events: readonly GameEvent[],
    actor: Actor,
    action: Action | null,
    actorSeat: Seat | null,
    keepTurns: boolean,
  ): void {
    const state = this.state();
    this.version++;
    this.deps.record?.({ at: this.deps.scheduler.now(), actor, action, events, state });
    if (state.matchWinner !== null) {
      this.current = 'finished';
      this.clearTimers();
      this.publish(events);
      this.deps.onFinished?.(state.matchWinner);
      return;
    }
    this.armAfterChange(actorSeat, keepTurns);
    this.publish(events);
  }

  /** Arma los turnos pendientes o, al terminar la mano, el reparto de la siguiente (D19). */
  private armAfterChange(actorSeat: Seat | null, keepTurns: boolean): void {
    const state = this.state();
    if (state.hand.phase.kind === 'handOver') {
      this.clearTimers();
      this.nextHandTimer = this.deps.scheduler.schedule(this.deps.timing.handPauseMs, () => {
        this.guard('siguiente mano', () => {
          this.dealNextHand();
        });
      });
      return;
    }
    this.turns.sync(
      pendingSeats(state),
      (seat) => keepTurns && seat !== actorSeat,
      (seat) => {
        const control = this.deps.control(seat);
        return control.kind === 'bot' ? control.persona : null;
      },
    );
  }

  private dealNextHand(): void {
    this.nextHandTimer = null;
    const result = startNextHand(this.state(), { rng: this.deps.rng });
    /* v8 ignore next 4 -- solo se programa con la mano terminada y la partida sin ganador. */
    if (!result.ok) {
      this.deps.logger.error({ code: result.error.code }, 'no se pudo repartir');
      return;
    }
    this.matchState = result.value.state;
    this.commit(result.value.events, { by: 'system' }, null, null, false);
  }

  private onBotTurn(seat: Seat, persona: BotPersona): void {
    const state = this.state();
    const { action } = decideAction({
      view: getView(state, seat),
      legal: getLegalActions(state, seat),
      persona,
      rng: this.deps.rng,
    });
    this.applyOrLog(seat, action, { seat, by: 'bot' });
  }

  private onTimeout(seat: Seat): void {
    const action = getTimeoutAction(this.state(), seat);
    /* v8 ignore next 4 -- el motor siempre tiene acción por tiempo para un asiento pendiente. */
    if (action === null) {
      this.deps.logger.error({ seat }, 'sin acción por tiempo agotado');
      return;
    }
    this.applyOrLog(seat, action, { seat, by: 'timeout' });
  }

  private applyOrLog(seat: Seat, action: Action, actor: Actor): void {
    const error = this.apply(seat, action, actor);
    /* v8 ignore next -- bots y temporizador eligen siempre acciones legales del motor. */
    if (error !== null)
      this.deps.logger.error({ seat, code: error }, 'acción automática rechazada');
  }

  /** Un error en un temporizador no puede dejar la mesa colgada en silencio. */
  private guard(what: string, fn: () => void): void {
    try {
      fn();
    } catch (error) {
      this.deps.logger.error({ err: error, what }, 'error en la partida');
    }
  }

  private publish(events: readonly GameEvent[]): void {
    const snapshot = this.snapshot();
    if (snapshot !== null) this.deps.publish({ ...snapshot, events });
  }

  private clearTimers(): void {
    this.turns.clear();
    this.nextHandTimer?.cancel();
    this.nextHandTimer = null;
  }

  private state(): MatchState {
    /* v8 ignore next -- solo se llama con la partida empezada. */
    if (this.matchState === null) throw new Error('La partida no ha empezado.');
    return this.matchState;
  }
}
