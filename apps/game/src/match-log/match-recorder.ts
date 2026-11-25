// Convierte los pasos del controlador en el log de la partida (ADR-0004 §4): agrupa por mano y
// escribe en el `MatchLogStore` en orden. Un fallo al escribir se registra y la partida sigue: el
// log nunca puede dejar una mesa colgada (la entrega garantizada se decide con Prisma en H6).
import type { MatchState } from '@31mus/engine';

import type { Logger } from '../infra/logger.js';
import type { Scheduler } from '../infra/scheduler.js';
import type { StepRecord } from '../table/match-types.js';
import type {
  HandRecord,
  LoggedStep,
  MatchEnd,
  MatchLogStore,
  MatchMeta,
  Scoreboard,
} from './match-log.js';

export interface MatchRecorderDeps {
  readonly store: MatchLogStore;
  readonly logger: Logger;
  readonly scheduler: Pick<Scheduler, 'now'>;
}

interface OpenHand {
  readonly start: MatchState;
  readonly startedAt: number;
  readonly steps: LoggedStep[];
}

function scoreboard(state: MatchState): Scoreboard {
  return { scores: state.scores, gamesWon: state.gamesWon };
}

export class MatchRecorder {
  private queue: Promise<void> = Promise.resolve();
  private hand: OpenHand | null = null;
  private last: MatchState | null = null;
  private hands = 0;
  private finished = false;

  constructor(
    private readonly meta: MatchMeta,
    private readonly deps: MatchRecorderDeps,
  ) {
    this.enqueue(() => deps.store.startMatch(meta));
  }

  /** Un paso de la partida. Al acabar la mano la escribe; al acabar la partida, también el final. */
  step({ at, actor, action, events, state }: StepRecord): void {
    if (this.finished) return;
    this.last = state;
    this.hand ??= { start: state, startedAt: at, steps: [] };
    this.hand.steps.push({ at, actor, action, events });
    if (state.hand.phase.kind === 'handOver') this.closeHand(state, at, true);
    if (state.matchWinner !== null) this.finish('won');
  }

  /** Cierra el log: con ganador o abandonada. Si quedaba una mano a medias, se guarda incompleta. */
  finish(end: MatchEnd): void {
    if (this.finished) return;
    this.finished = true;
    const endedAt = this.deps.scheduler.now();
    if (this.last !== null && this.hand !== null) this.closeHand(this.last, endedAt, false);
    const result = {
      matchId: this.meta.matchId,
      end,
      winner: end === 'won' ? (this.last?.matchWinner ?? null) : null,
      endedAt,
      gamesWon: this.last?.gamesWon ?? ([0, 0] as const),
      hands: this.hands,
    };
    this.enqueue(() => this.deps.store.finishMatch(result));
  }

  /** Se resuelve cuando todo lo pendiente está escrito (o ha fallado y se ha registrado). */
  flushed(): Promise<void> {
    return this.queue;
  }

  private closeHand(state: MatchState, endedAt: number, complete: boolean): void {
    const hand = this.hand;
    /* v8 ignore next -- solo se cierra una mano abierta. */
    if (hand === null) return;
    this.hand = null;
    this.hands++;
    const record: HandRecord = {
      matchId: this.meta.matchId,
      number: hand.start.hand.number,
      gameNumber: hand.start.gameNumber,
      mano: hand.start.mano,
      dealt: hand.start.hand.hands,
      startedAt: hand.startedAt,
      endedAt,
      before: scoreboard(hand.start),
      after: scoreboard(state),
      steps: hand.steps,
      complete,
    };
    this.enqueue(() => this.deps.store.appendHand(record));
  }

  /** Escribe en orden; un fallo se registra (sin datos de la partida) y no corta la cola. */
  private enqueue(write: () => Promise<void>): void {
    this.queue = this.queue.then(write).catch((err: unknown) => {
      this.deps.logger.error({ err, matchId: this.meta.matchId }, 'no se pudo escribir el log');
    });
  }
}
