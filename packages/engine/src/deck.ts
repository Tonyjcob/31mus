/**
 * Mazo, reparto, reposición tras el descarte y rebarajado (REGLAS_MUS.md §3, D10).
 * La carta de arriba del mazo es `deck[0]`.
 */
import { FULL_DECK } from './cards.js';
import type { Card } from './cards.js';
import { HAND_SIZE } from './rules.js';
import { shuffle } from './rng.js';
import type { Rng } from './rng.js';
import { perSeat, seatsFrom } from './seat.js';
import type { PerSeat, Seat } from './seat.js';

/** Cartas que no están en ninguna mano: el mazo por repartir y los descartes acumulados. */
export interface CardPile {
  readonly deck: readonly Card[];
  readonly discards: readonly Card[];
}

export interface Deal {
  readonly hands: PerSeat<readonly Card[]>;
  readonly pile: CardPile;
}

export interface Replenishment {
  /** Cartas que recibe cada asiento, en el orden en que las recibe. */
  readonly drawn: PerSeat<readonly Card[]>;
  readonly pile: CardPile;
  /** Si hubo que barajar los descartes para completar la reposición. */
  readonly reshuffled: boolean;
}

/** Las 40 cartas barajadas con Fisher–Yates sobre el `Rng` inyectado. */
export function shuffledDeck(rng: Rng): readonly Card[] {
  return shuffle(FULL_DECK, rng);
}

/** Reparte 4 cartas a cada jugador, de una en una, empezando por la mano. */
export function dealHands(deck: readonly Card[], mano: Seat): Deal {
  const order = seatsFrom(mano);
  const hands: [Card[], Card[], Card[], Card[]] = [[], [], [], []];
  let next = 0;
  for (let round = 0; round < HAND_SIZE; round++) {
    for (const seat of order) {
      hands[seat].push(takeAt(deck, next));
      next++;
    }
  }
  return { hands, pile: { deck: deck.slice(next), discards: [] } };
}

/**
 * Repone a cada jugador las cartas que descartó, por orden desde la mano y todas las de un
 * jugador seguidas. Si el mazo se acaba, se reparte lo que quede y después se barajan **todos**
 * los descartes, incluidos los de esta ronda (D10). Los descartes de la ronda deben estar ya en
 * `pile.discards`.
 */
export function replenish(
  pile: CardPile,
  counts: PerSeat<number>,
  mano: Seat,
  rng: Rng,
): Replenishment {
  let deck = pile.deck;
  let discards = pile.discards;
  let reshuffled = false;
  const drawn: [Card[], Card[], Card[], Card[]] = [[], [], [], []];

  for (const seat of seatsFrom(mano)) {
    for (let i = 0; i < counts[seat]; i++) {
      if (deck.length === 0) {
        deck = shuffle(discards, rng);
        discards = [];
        reshuffled = true;
      }
      drawn[seat].push(takeAt(deck, 0));
      deck = deck.slice(1);
    }
  }
  return { drawn, pile: { deck, discards }, reshuffled };
}

/** Cartas que ve cada mano tras sustituir las descartadas por las repuestas. */
export function applyReplenishment(
  hands: PerSeat<readonly Card[]>,
  discarded: PerSeat<readonly Card[]>,
  drawn: PerSeat<readonly Card[]>,
): PerSeat<readonly Card[]> {
  return perSeat((seat) => [
    ...hands[seat].filter((card) => !discarded[seat].includes(card)),
    ...drawn[seat],
  ]);
}

function takeAt(cards: readonly Card[], index: number): Card {
  const card = cards[index];
  if (card === undefined) {
    // Invariante: siempre quedan cartas suficientes (40 − 16 en manos ≥ lo que se repone).
    throw new RangeError('No quedan cartas que repartir.');
  }
  return card;
}
