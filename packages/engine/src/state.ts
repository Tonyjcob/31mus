/**
 * Estado de la partida (ADR-0002 §1): datos planos serializables a JSON e inmutables.
 * Nunca contiene el `Rng` ni su semilla.
 */
import type { Card } from './cards.js';
import type { CardPile } from './deck.js';
import type { Lance } from './evaluators/lances.js';
import type { PerSeat, Seat, Team } from './seat.js';

/** Un número por pareja, indexado por `Team`. */
export type Score = readonly [number, number];

/** Cómo terminó un lance; el recuento lo usa para cobrar (REGLAS_MUS.md §5–6). */
export type LanceOutcome =
  /** Nadie tenía jugada (pares o juego): no se juega. */
  | { readonly kind: 'noJugado' }
  /** Solo una pareja tenía jugada: cobra sus jugadas sin envite. */
  | { readonly kind: 'sinEnvite'; readonly team: Team }
  /** Todos pasaron. */
  | { readonly kind: 'paso' }
  /** Apuesta aceptada: la cobra el ganador del lance. */
  | { readonly kind: 'querido'; readonly amount: number }
  /** Apuesta rechazada: `team` (la que apostó) ya cobró la negada o el deje. */
  | { readonly kind: 'rechazado'; readonly team: Team };

export interface LanceRecord {
  readonly lance: Lance;
  readonly outcome: LanceOutcome;
}

export type BetResponse = 'quiero' | 'noQuiero';

/** Apuesta abierta en un lance (D12, D13). */
export interface Bet {
  /** Pareja que hizo la última apuesta o subida. */
  readonly team: Team;
  /** Tantos en juego si se acepta (sin contar el órdago). */
  readonly total: number;
  /** Lo que cobra `team` si se rechaza: la negada o el deje (§5.3). */
  readonly onReject: number;
  /** `true` si ya hubo una subida (lo rechazado es un deje, no una negada). */
  readonly raised: boolean;
  readonly ordago: boolean;
  /** Rivales que responden, en orden: el primero y, si tiene jugada, su compañero (§5.1). */
  readonly responders: readonly Seat[];
  /** Respuesta provisional del primer rival mientras habla su compañero. */
  readonly firstResponse: BetResponse | null;
}

export type Phase =
  | { readonly kind: 'mus'; readonly turn: Seat }
  /** Descarte en paralelo: `null` mientras el asiento no ha descartado (§3). */
  | { readonly kind: 'discard'; readonly discards: PerSeat<readonly Card[] | null> }
  | {
      readonly kind: 'lance';
      readonly lance: Lance;
      /** Quienes hablan en este lance, en orden desde la mano. */
      readonly speakers: readonly Seat[];
      readonly turn: Seat;
      readonly bet: Bet | null;
    }
  /** Mano terminada y cartas enseñadas (D16). `gameWinner` si en esta mano se cerró un juego. */
  | { readonly kind: 'handOver'; readonly gameWinner: Team | null };

export type LancePhase = Extract<Phase, { kind: 'lance' }>;
export type DiscardPhase = Extract<Phase, { kind: 'discard' }>;

/** Declaraciones de pares y juego, públicas desde que empieza su lance (§4.3–4.4). */
export interface Declarations {
  readonly pares: PerSeat<boolean> | null;
  readonly juego: PerSeat<boolean> | null;
}

export interface HandState {
  /** Número de mano dentro de la partida, desde 1. */
  readonly number: number;
  readonly hands: PerSeat<readonly Card[]>;
  readonly pile: CardPile;
  readonly phase: Phase;
  /** Lances ya cerrados, en orden. */
  readonly lances: readonly LanceRecord[];
  readonly declarations: Declarations;
  /** Cuántas cartas descartó cada uno en la última ronda de descarte. */
  readonly lastDiscardCounts: PerSeat<number> | null;
}

export interface MatchState {
  readonly mano: Seat;
  /** Tantos del juego en curso. */
  readonly scores: Score;
  readonly gamesWon: Score;
  /** Número de juego dentro de la partida, desde 1. */
  readonly gameNumber: number;
  readonly hand: HandState;
  readonly matchWinner: Team | null;
}

export interface MatchConfig {
  /** Primer mano de la partida. Si falta, se sortea con el `Rng` (§2). */
  readonly firstMano?: Seat;
}
