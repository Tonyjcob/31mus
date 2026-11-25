// Log de partidas (CLAUDE.md §2.5, ADR-0004 §4): cada mano con sus eventos COMPLETOS del motor,
// la hora y el autor de cada paso, y el marcador antes y después. Contiene cartas: es solo de
// servidor; nunca se envía a un cliente ni se escribe en los logs de pino.
import type { Action, Card, GameEvent, PerSeat, Score, Seat, Team } from '@31mus/engine';
import type { RoomMode } from '@31mus/shared';

import type { Actor } from '../table/match-types.js';

/** Quién ocupaba cada asiento al empezar. Si luego juega un bot por un humano, lo dice el `actor`. */
export type SeatMeta =
  | {
      readonly seat: Seat;
      readonly kind: 'human';
      readonly userId: string;
      readonly nickname: string;
    }
  | { readonly seat: Seat; readonly kind: 'bot'; readonly personaId: string };

export interface MatchMeta {
  readonly matchId: string;
  readonly roomId: string;
  readonly mode: RoomMode;
  readonly startedAt: number;
  readonly seats: readonly SeatMeta[];
}

/** Un cambio de estado: una acción (o el sistema al repartir) y los eventos que produjo. */
export interface LoggedStep {
  readonly at: number;
  readonly actor: Actor;
  readonly action: Action | null;
  readonly events: readonly GameEvent[];
}

export interface Scoreboard {
  readonly scores: Score;
  readonly gamesWon: Score;
}

export interface HandRecord {
  readonly matchId: string;
  /** Número de mano dentro de la partida, desde 1. */
  readonly number: number;
  readonly gameNumber: number;
  readonly mano: Seat;
  /** Cartas repartidas a cada asiento al empezar la mano. */
  readonly dealt: PerSeat<readonly Card[]>;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly before: Scoreboard;
  readonly after: Scoreboard;
  readonly steps: readonly LoggedStep[];
  /** `false` si la partida se cerró a mitad de esta mano. */
  readonly complete: boolean;
}

export type MatchEnd = 'won' | 'abandoned';

export interface MatchResult {
  readonly matchId: string;
  readonly end: MatchEnd;
  readonly winner: Team | null;
  readonly endedAt: number;
  readonly gamesWon: Score;
  readonly hands: number;
}

/** Puerto de persistencia. H3: memoria y ficheros; H6: Prisma desde `packages/db` (D18). */
export interface MatchLogStore {
  startMatch(meta: MatchMeta): Promise<void>;
  appendHand(record: HandRecord): Promise<void>;
  finishMatch(result: MatchResult): Promise<void>;
}
