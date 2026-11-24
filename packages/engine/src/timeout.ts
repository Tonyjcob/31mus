/**
 * Acción por defecto al agotarse el turno (REGLAS_MUS.md §8). El temporizador vive en el servidor;
 * el motor solo dice qué aplicar (CLAUDE.md §6).
 */
import type { Action } from './actions.js';
import { musRank } from './cards.js';
import type { Card, MusRank } from './cards.js';
import { first } from './invariant.js';
import type { Seat } from './seat.js';
import type { MatchState } from './state.js';

/** Orden de descarte por tiempo agotado (D15): 4, 5, 6, 7, S, C, A, R. */
export const TIMEOUT_DISCARD_ORDER: readonly MusRank[] = [4, 5, 6, 7, 10, 11, 1, 12];

/**
 * La carta que se descarta por tiempo agotado (D15): la primera, en el orden de arriba, que no
 * forme pareja; si todas forman jugada, la primera en ese mismo orden.
 */
export function timeoutDiscard(hand: readonly Card[]): Card {
  const sameRank = (card: Card) => hand.filter((c) => musRank(c) === musRank(card)).length;
  const ordered = TIMEOUT_DISCARD_ORDER.flatMap((rank) => hand.filter((c) => musRank(c) === rank));
  return ordered.find((card) => sameRank(card) === 1) ?? first(ordered, 'mano vacía');
}

/** Acción por defecto de `seat`, o `null` si no le toca actuar. */
export function getTimeoutAction(state: MatchState, seat: Seat): Action | null {
  const { phase, hands } = state.hand;
  switch (phase.kind) {
    case 'mus':
      return phase.turn === seat ? { type: 'corto' } : null;
    case 'discard':
      return phase.discards[seat] === null
        ? { type: 'discard', cards: [timeoutDiscard(hands[seat])] }
        : null;
    case 'lance':
      if (phase.turn !== seat) return null;
      if (phase.bet === null) return { type: 'paso' };
      // El compañero del primer rival mantiene la respuesta de este (D12); si no, no quiero.
      return { type: phase.bet.firstResponse ?? 'noQuiero' };
    case 'handOver':
      return null;
  }
}
