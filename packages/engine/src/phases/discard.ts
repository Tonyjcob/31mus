/**
 * Descarte en paralelo (REGLAS_MUS.md §3.2): cada uno elige de 1 a 4 cartas, el motor las guarda
 * sin revelarlas y, cuando han descartado los cuatro, revela cuántas, repone desde la mano
 * (rebarajando si hace falta, D10) y vuelve a la fase de mus.
 */
import type { Card } from '../cards.js';
import { applyReplenishment, replenish } from '../deck.js';
import type { Rng } from '../rng.js';
import { perSeat, seatsFrom } from '../seat.js';
import type { PerSeat, Seat } from '../seat.js';
import type { DiscardPhase } from '../state.js';
import { emit, setPhase, updateHand } from '../step.js';
import type { Step } from '../step.js';

export function applyDiscard(
  step: Step,
  phase: DiscardPhase,
  seat: Seat,
  cards: readonly Card[],
  rng: Rng,
): Step {
  // Se guardan en el orden de la mano del jugador, sea cual sea el orden recibido.
  const ordered = step.state.hand.hands[seat].filter((card) => cards.includes(card));
  const discards = perSeat((s) => (s === seat ? ordered : phase.discards[s]));
  const submitted = emit(setPhase(step, { kind: 'discard', discards }), {
    type: 'discardSubmitted',
    seat,
    cards: ordered,
  });

  const complete = completeDiscards(discards);
  return complete === null ? submitted : finishDiscard(submitted, complete, rng);
}

function completeDiscards(
  discards: PerSeat<readonly Card[] | null>,
): PerSeat<readonly Card[]> | null {
  const [a, b, c, d] = discards;
  return a !== null && b !== null && c !== null && d !== null ? [a, b, c, d] : null;
}

function finishDiscard(step: Step, discarded: PerSeat<readonly Card[]>, rng: Rng): Step {
  const { mano, hand } = step.state;
  const order = seatsFrom(mano);
  const counts = perSeat((s) => discarded[s].length);
  // Los descartes de la ronda se suman a los acumulados antes de reponer: si hace falta
  // rebarajar, entran también (D10).
  const pile = {
    deck: hand.pile.deck,
    discards: [...hand.pile.discards, ...order.flatMap((s) => discarded[s])],
  };
  const result = replenish(pile, counts, mano, rng);

  const next = updateHand(step, {
    hands: applyReplenishment(hand.hands, discarded, result.drawn),
    pile: result.pile,
    phase: { kind: 'mus', turn: mano },
    lastDiscardCounts: counts,
  });
  return emit(
    next,
    { type: 'discardsRevealed', counts },
    ...(result.reshuffled ? [{ type: 'discardsReshuffled' as const }] : []),
    ...order.map((seat) => ({ type: 'cardsDrawn' as const, seat, cards: result.drawn[seat] })),
  );
}
