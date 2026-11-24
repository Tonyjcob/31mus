/**
 * Vista de la partida para un jugador o espectador (REGLAS_MUS.md §9, ADR-0002 §3). Es la única
 * forma en que el estado sale del servidor: nunca incluye cartas ajenas antes del fin de mano, y
 * a los espectadores no les da ninguna carta (CLAUDE.md §7).
 */
import type { Card } from './cards.js';
import type { Lance } from './evaluators/lances.js';
import type { Viewer } from './events.js';
import { pendingSeats } from './legal-actions.js';
import { HAND_SIZE, RESHUFFLE_WARNING_THRESHOLD } from './rules.js';
import { perSeat } from './seat.js';
import type { PerSeat, Seat, Team } from './seat.js';
import type { Bet, Declarations, LanceRecord, MatchState, Score } from './state.js';

export type PhaseView =
  | { readonly kind: 'mus'; readonly turn: Seat }
  /** Quién ha descartado ya (no cuántas ni cuáles). */
  | { readonly kind: 'discard'; readonly done: PerSeat<boolean> }
  | {
      readonly kind: 'lance';
      readonly lance: Lance;
      readonly speakers: readonly Seat[];
      readonly turn: Seat;
      readonly bet: Bet | null;
    }
  | { readonly kind: 'handOver'; readonly gameWinner: Team | null };

export interface PlayerView {
  readonly viewer: Viewer;
  readonly mano: Seat;
  readonly scores: Score;
  readonly gamesWon: Score;
  readonly gameNumber: number;
  readonly handNumber: number;
  readonly matchWinner: Team | null;
  readonly phase: PhaseView;
  readonly pendingSeats: readonly Seat[];
  /** Cartas propias; `null` para espectadores. */
  readonly ownCards: readonly Card[] | null;
  /** Descarte propio ya enviado y aún sin revelar; `null` si no hay. */
  readonly ownDiscard: readonly Card[] | null;
  readonly cardCounts: PerSeat<number>;
  readonly deckCount: number;
  /** Aviso "puede que se barajen los descartes" (D10). */
  readonly reshuffleWarning: boolean;
  readonly lastDiscardCounts: PerSeat<number> | null;
  readonly declarations: Declarations;
  readonly lances: readonly LanceRecord[];
  /** Las cuatro manos, solo al terminar la mano y solo para jugadores (D16). */
  readonly revealedHands: PerSeat<readonly Card[]> | null;
}

function phaseView(state: MatchState): PhaseView {
  const { phase } = state.hand;
  switch (phase.kind) {
    case 'discard':
      return { kind: 'discard', done: perSeat((seat) => phase.discards[seat] !== null) };
    case 'mus':
    case 'lance':
    case 'handOver':
      return phase;
  }
}

export function getView(state: MatchState, viewer: Viewer): PlayerView {
  const { hand } = state;
  const { phase } = hand;
  const isPlayer = viewer !== 'spectator';
  return {
    viewer,
    mano: state.mano,
    scores: state.scores,
    gamesWon: state.gamesWon,
    gameNumber: state.gameNumber,
    handNumber: hand.number,
    matchWinner: state.matchWinner,
    phase: phaseView(state),
    pendingSeats: pendingSeats(state),
    ownCards: isPlayer ? hand.hands[viewer] : null,
    ownDiscard: isPlayer && phase.kind === 'discard' ? phase.discards[viewer] : null,
    cardCounts: perSeat(() => HAND_SIZE),
    deckCount: hand.pile.deck.length,
    reshuffleWarning: phase.kind === 'mus' && hand.pile.deck.length < RESHUFFLE_WARNING_THRESHOLD,
    lastDiscardCounts: hand.lastDiscardCounts,
    declarations: hand.declarations,
    lances: hand.lances,
    revealedHands: isPlayer && phase.kind === 'handOver' ? hand.hands : null,
  };
}
