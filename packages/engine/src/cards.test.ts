import { describe, expect, it } from 'vitest';

import { FULL_DECK, MUS_RANKS, cardPoints, cardRank, cardSuit, isCard, musRank } from './cards.js';
import type { Card } from './cards.js';

describe('baraja', () => {
  it('tiene 40 cartas distintas: 10 números en 4 palos (§1)', () => {
    expect(FULL_DECK).toHaveLength(40);
    expect(new Set(FULL_DECK).size).toBe(40);
  });

  it('separa palo y número', () => {
    expect(cardSuit('espadas-11')).toBe('espadas');
    expect(cardRank('espadas-11')).toBe(11);
  });

  it('valida valores externos', () => {
    expect(isCard('oros-12')).toBe(true);
    for (const value of ['oros-8', 'oros-9', 'rojo-1', 'oros', '', 12, null, undefined]) {
      expect(isCard(value)).toBe(false);
    }
  });

  it('rechaza una carta imposible que se haya saltado los tipos', () => {
    expect(() => cardRank('oros-9' as Card)).toThrow(TypeError);
  });
});

describe('8 reyes (§1.1)', () => {
  it('el 3 es rey y el 2 es as; el resto conserva su rango', () => {
    expect(musRank('copas-3')).toBe(12);
    expect(musRank('copas-12')).toBe(12);
    expect(musRank('bastos-2')).toBe(1);
    expect(musRank('bastos-1')).toBe(1);
    expect(musRank('oros-7')).toBe(7);
    expect(musRank('oros-10')).toBe(10);
  });

  it('hay 8 rangos de mus en orden A < 4 < 5 < 6 < 7 < S < C < R, con 8 reyes y 8 ases', () => {
    expect(MUS_RANKS).toEqual([1, 4, 5, 6, 7, 10, 11, 12]);
    const count = (rank: number) => FULL_DECK.filter((c) => musRank(c) === rank).length;
    expect(count(12)).toBe(8);
    expect(count(1)).toBe(8);
    expect(count(7)).toBe(4);
  });
});

describe('valor para juego y punto (§1.2)', () => {
  it('figuras y treses 10, 4–7 su número, ases y doses 1', () => {
    expect(cardPoints('oros-12')).toBe(10);
    expect(cardPoints('oros-11')).toBe(10);
    expect(cardPoints('oros-10')).toBe(10);
    expect(cardPoints('oros-3')).toBe(10);
    expect(cardPoints('oros-7')).toBe(7);
    expect(cardPoints('oros-4')).toBe(4);
    expect(cardPoints('oros-2')).toBe(1);
    expect(cardPoints('oros-1')).toBe(1);
  });

  it('la baraja suma 256 (4 palos × 64: 1 + 1 + 10 + 4 + 5 + 6 + 7 + 10 + 10 + 10)', () => {
    expect(FULL_DECK.reduce((acc, c) => acc + cardPoints(c), 0)).toBe(256);
  });
});
