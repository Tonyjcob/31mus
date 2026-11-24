/** Reparto de una mano nueva (REGLAS_MUS.md §3.1). */
import { dealHands, shuffledDeck } from '../deck.js';
import type { Rng } from '../rng.js';
import { seatsFrom } from '../seat.js';
import type { MatchState } from '../state.js';
import type { Step } from '../step.js';

/** Datos de la partida que no dependen de la mano. */
export type MatchBase = Omit<MatchState, 'hand'>;

/** Baraja, reparte desde la mano y abre la fase de mus por la mano. */
export function dealHand(base: MatchBase, handNumber: number, rng: Rng): Step {
  const { hands, pile } = dealHands(shuffledDeck(rng), base.mano);
  const state: MatchState = {
    ...base,
    hand: {
      number: handNumber,
      hands,
      pile,
      phase: { kind: 'mus', turn: base.mano },
      lances: [],
      declarations: { pares: null, juego: null },
      lastDiscardCounts: null,
    },
  };
  return {
    state,
    events: [
      { type: 'handStarted', handNumber, gameNumber: base.gameNumber, mano: base.mano },
      ...seatsFrom(base.mano).map((seat) => ({
        type: 'cardsDealt' as const,
        seat,
        cards: hands[seat],
      })),
    ],
  };
}
