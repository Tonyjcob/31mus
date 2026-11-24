import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { FULL_DECK } from './cards.js';
import type { Card } from './cards.js';
import { applyReplenishment, dealHands, replenish, shuffledDeck } from './deck.js';
import type { CardPile } from './deck.js';
import { createSeededRng } from './rng.js';
import type { Rng } from './rng.js';
import { SEATS, perSeat } from './seat.js';
import type { PerSeat, Seat } from './seat.js';

const seatArb = fc.constantFrom<Seat>(...SEATS);
const countArb = fc.integer({ min: 1, max: 4 });
const countsArb = fc.tuple(countArb, countArb, countArb, countArb);

function allCards(hands: PerSeat<readonly Card[]>, pile: CardPile): Card[] {
  return [...hands.flat(), ...pile.deck, ...pile.discards];
}

/** Una ronda de mus: cada jugador descarta sus `counts[seat]` primeras cartas y repone. */
function discardRound(
  hands: PerSeat<readonly Card[]>,
  pile: CardPile,
  counts: PerSeat<number>,
  mano: Seat,
  rng: Rng,
) {
  const discarded = perSeat((seat) => hands[seat].slice(0, counts[seat]));
  const withDiscards = { ...pile, discards: [...pile.discards, ...discarded.flat()] };
  const result = replenish(withDiscards, counts, mano, rng);
  return { ...result, hands: applyReplenishment(hands, discarded, result.drawn) };
}

describe('reparto', () => {
  it('baraja las 40 cartas', () => {
    const deck = shuffledDeck(createSeededRng(1));
    expect([...deck].sort()).toEqual([...FULL_DECK].sort());
  });

  it('reparte 4 cartas a cada uno, de una en una empezando por la mano', () => {
    const { hands, pile } = dealHands(FULL_DECK, 2);
    // Orden 2, 3, 0, 1: el asiento 2 recibe las cartas 0, 4, 8 y 12 del mazo.
    expect(hands[2]).toEqual([FULL_DECK[0], FULL_DECK[4], FULL_DECK[8], FULL_DECK[12]]);
    expect(hands[3]).toEqual([FULL_DECK[1], FULL_DECK[5], FULL_DECK[9], FULL_DECK[13]]);
    expect(hands[1]).toEqual([FULL_DECK[3], FULL_DECK[7], FULL_DECK[11], FULL_DECK[15]]);
    expect(pile.deck).toEqual(FULL_DECK.slice(16));
    expect(pile.discards).toEqual([]);
  });

  it('falla si el mazo no tiene 16 cartas (invariante roto)', () => {
    expect(() => dealHands(FULL_DECK.slice(0, 10), 0)).toThrow(RangeError);
  });
});

describe('reposición y rebarajado (D10)', () => {
  it('repone por orden desde la mano, todas las cartas de cada jugador seguidas', () => {
    const { hands, pile } = dealHands(FULL_DECK, 1);
    const r = discardRound(hands, pile, [1, 2, 0, 3], 1, createSeededRng(0));
    expect(r.reshuffled).toBe(false);
    // Orden 1, 2, 3, 0: el 1 recibe 2 cartas, el 2 ninguna, el 3 tres y el 0 una.
    expect(r.drawn[1]).toEqual(FULL_DECK.slice(16, 18));
    expect(r.drawn[2]).toEqual([]);
    expect(r.drawn[3]).toEqual(FULL_DECK.slice(18, 21));
    expect(r.drawn[0]).toEqual(FULL_DECK.slice(21, 22));
    expect(r.hands.every((h) => h.length === 4)).toBe(true);
  });

  it('si el mazo no llega, reparte lo que queda y después baraja todos los descartes', () => {
    const { hands, pile } = dealHands(FULL_DECK, 0);
    // Mazo con 2 cartas y 3 descartes previos; se piden 4 + 4.
    const short: CardPile = { deck: pile.deck.slice(0, 2), discards: pile.deck.slice(2, 5) };
    const r = discardRound(hands, short, [4, 4, 0, 0], 0, createSeededRng(5));
    expect(r.reshuffled).toBe(true);
    // El asiento 0 recibe primero las 2 que quedaban en el mazo.
    expect(r.drawn[0].slice(0, 2)).toEqual(pile.deck.slice(0, 2));
    // Lo demás sale de los descartes barajados: los 3 previos y los 8 de esta ronda.
    const pool = new Set([...pile.deck.slice(2, 5), ...hands[0], ...hands[1]]);
    for (const card of [...r.drawn[0].slice(2), ...r.drawn[1]]) {
      expect(pool.has(card)).toBe(true);
    }
    expect(r.pile.discards).toEqual([]);
    expect(r.pile.deck).toHaveLength(11 - 6);
  });

  it('invariante: siempre hay 40 cartas distintas entre manos, mazo y descartes', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        seatArb,
        fc.array(countsArb, { maxLength: 30 }),
        (seed, mano, rounds) => {
          const rng = createSeededRng(seed);
          let { hands, pile } = dealHands(shuffledDeck(rng), mano);
          for (const counts of rounds) {
            ({ hands, pile } = discardRound(hands, pile, counts, mano, rng));
            const cards = allCards(hands, pile);
            expect(cards).toHaveLength(40);
            expect(new Set(cards).size).toBe(40);
            expect(hands.every((h) => h.length === 4)).toBe(true);
          }
        },
      ),
    );
  });
});
