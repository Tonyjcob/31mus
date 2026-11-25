// La partida de una mesa ya empezada (ADR-0004 §5): une el `MatchController` con quién controla
// cada asiento (`Lobby`), publica a cada destinatario su vista filtrada (`outbound.ts`), pausa sin
// humanos conectados y cierra la mesa al terminar o si nadie vuelve (D20). Sin Colyseus.
import { NEUTRAL_PERSONA } from '@31mus/bots';
import type { Rng, Seat, Viewer } from '@31mus/engine';
import {
  BOT_DELAY_MAX_MS,
  BOT_DELAY_MIN_MS,
  EMPTY_ROOM_TIMEOUT_MS,
  FINISHED_ROOM_LINGER_MS,
  HAND_PAUSE_MS,
  SERVER_MESSAGES,
  TURN_TIMEOUT_MS,
  type ActionResultMessage,
  type GameActionMessage,
  type RoomStatus,
} from '@31mus/shared';

import type { Logger } from '../infra/logger.js';
import type { Scheduler, TimerHandle } from '../infra/scheduler.js';
import type { Lobby } from './lobby.js';
import {
  MatchController,
  type MatchTiming,
  type SeatControl,
  type StepRecord,
} from './match-controller.js';
import { buildEventsMessage, buildViewMessage, type MatchSnapshot } from './outbound.js';

export interface TableTiming extends MatchTiming {
  /** Sin humanos conectados, tiempo hasta cerrar la mesa como abandonada (D20). */
  readonly emptyRoomMs: number;
  /** Tiempo que la mesa sigue abierta tras el fin, para ver el resultado. */
  readonly finishedLingerMs: number;
}

export const DEFAULT_TABLE_TIMING: TableTiming = {
  turnMs: TURN_TIMEOUT_MS,
  botDelayMinMs: BOT_DELAY_MIN_MS,
  botDelayMaxMs: BOT_DELAY_MAX_MS,
  handPauseMs: HAND_PAUSE_MS,
  emptyRoomMs: EMPTY_ROOM_TIMEOUT_MS,
  finishedLingerMs: FINISHED_ROOM_LINGER_MS,
};

/** Alguien que recibe la partida: un jugador sentado o un espectador. */
export interface Recipient {
  readonly viewer: Viewer;
  send(type: string, payload: unknown): void;
}

export type TableEnd = 'won' | 'abandoned';

export interface TableSessionDeps {
  readonly lobby: Lobby;
  readonly scheduler: Scheduler;
  readonly rng: Rng;
  readonly logger: Logger;
  readonly timing: TableTiming;
  recipients(): Iterable<Recipient>;
  /** Cambió el estado público (pausa, reanudación, fin). */
  onStatusChange(): void;
  /** La mesa debe cerrarse. */
  onClose(end: TableEnd): void;
  record?(step: StepRecord): void;
}

export class TableSession {
  private readonly controller: MatchController;
  private emptyTimer: TimerHandle | null = null;
  private closeTimer: TimerHandle | null = null;

  constructor(private readonly deps: TableSessionDeps) {
    this.controller = new MatchController({
      scheduler: deps.scheduler,
      rng: deps.rng,
      logger: deps.logger,
      timing: deps.timing,
      control: (seat) => this.control(seat),
      publish: (snapshot) => {
        this.publish(snapshot);
      },
      record: (step) => deps.record?.(step),
      onFinished: (winner) => {
        this.deps.logger.info({ winner }, 'partida terminada');
        this.deps.onStatusChange();
        this.closeTimer = this.deps.scheduler.schedule(this.deps.timing.finishedLingerMs, () => {
          this.deps.onClose('won');
        });
      },
    });
  }

  get status(): RoomStatus {
    const status = this.controller.status;
    return status === 'idle' ? 'lobby' : status;
  }

  start(): void {
    this.controller.start();
    this.deps.logger.info('partida empezada');
  }

  /** Envía el estado actual a quien acaba de entrar o volver. */
  sendCurrent(recipient: Recipient): void {
    const snapshot = this.controller.snapshot();
    if (snapshot === null) return;
    recipient.send(
      SERVER_MESSAGES.view,
      buildViewMessage(snapshot, recipient.viewer, this.deps.scheduler.now()),
    );
  }

  act(seat: Seat, message: GameActionMessage): ActionResultMessage {
    return this.controller.act(seat, message);
  }

  /** Un humano sentado se conectó o se desconectó (D7, D20). */
  connectionChanged(seat: Seat): void {
    this.controller.controlChanged(seat);
    if (this.controller.status === 'finished') return;
    if (this.deps.lobby.connectedHumans() === 0) {
      this.controller.pause();
      this.emptyTimer ??= this.deps.scheduler.schedule(this.deps.timing.emptyRoomMs, () => {
        this.deps.logger.info('mesa sin humanos: se cierra como abandonada');
        this.deps.onClose('abandoned');
      });
    } else {
      this.emptyTimer?.cancel();
      this.emptyTimer = null;
      this.controller.resume();
    }
    this.deps.onStatusChange();
  }

  dispose(): void {
    this.controller.dispose();
    this.emptyTimer?.cancel();
    this.closeTimer?.cancel();
  }

  /** Un humano conectado decide por su asiento; si no, juega un bot (el neutro si era humano). */
  private control(seat: Seat): SeatControl {
    const occupant = this.deps.lobby.occupant(seat);
    if (occupant.kind === 'bot') return { kind: 'bot', persona: occupant.persona };
    if (occupant.kind === 'human' && occupant.connected) return { kind: 'human' };
    return { kind: 'bot', persona: NEUTRAL_PERSONA };
  }

  private publish(snapshot: MatchSnapshot): void {
    const now = this.deps.scheduler.now();
    for (const recipient of this.deps.recipients()) {
      const events = buildEventsMessage(snapshot, recipient.viewer);
      if (events !== null) recipient.send(SERVER_MESSAGES.events, events);
      recipient.send(SERVER_MESSAGES.view, buildViewMessage(snapshot, recipient.viewer, now));
    }
  }
}
