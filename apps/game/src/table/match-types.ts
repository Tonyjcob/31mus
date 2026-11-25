// Tipos del controlador de partida y la memoria de `actionId` para la idempotencia (ADR-0004 §5).
import type { BotPersona } from '@31mus/bots';
import type { Action, GameEvent, MatchState, Rng, Seat, Team } from '@31mus/engine';
import type { ActionResultMessage } from '@31mus/shared';

import type { Logger } from '../infra/logger.js';
import type { Scheduler } from '../infra/scheduler.js';
import type { MatchSnapshot } from './outbound.js';

/** Quién decide por un asiento ahora: su humano conectado o un bot (D7). */
export type SeatControl =
  { readonly kind: 'human' } | { readonly kind: 'bot'; readonly persona: BotPersona };

/** Autor de un cambio, para el log de manos (ADR-0004 §4). */
export type Actor =
  { readonly seat: Seat; readonly by: 'human' | 'bot' | 'timeout' } | { readonly by: 'system' };

export interface MatchTiming {
  readonly turnMs: number;
  readonly botDelayMinMs: number;
  readonly botDelayMaxMs: number;
  readonly handPauseMs: number;
}

export interface StepRecord {
  readonly at: number;
  readonly actor: Actor;
  readonly action: Action | null;
  /** Eventos completos, con cartas: solo para el log del servidor. */
  readonly events: readonly GameEvent[];
  readonly state: MatchState;
}

export interface MatchControllerDeps {
  readonly scheduler: Scheduler;
  readonly rng: Rng;
  readonly logger: Logger;
  readonly timing: MatchTiming;
  control(seat: Seat): SeatControl;
  publish(snapshot: MatchSnapshot): void;
  record?(step: StepRecord): void;
  onFinished?(winner: Team): void;
}

export type MatchStatus = 'idle' | 'playing' | 'paused' | 'finished';

/** Últimas respuestas por asiento y `actionId`: un reenvío recibe la misma, sin aplicar nada. */
export class ActionMemory {
  private readonly bySeat = new Map<Seat, Map<string, ActionResultMessage>>();

  constructor(private readonly capacity: number) {}

  get(seat: Seat, actionId: string): ActionResultMessage | undefined {
    return this.bySeat.get(seat)?.get(actionId);
  }

  set(seat: Seat, result: ActionResultMessage): void {
    const seen = this.bySeat.get(seat) ?? new Map<string, ActionResultMessage>();
    seen.set(result.actionId, result);
    const oldest = seen.keys().next().value;
    if (seen.size > this.capacity && oldest !== undefined) seen.delete(oldest);
    this.bySeat.set(seat, seen);
  }
}
