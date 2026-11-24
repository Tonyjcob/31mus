import { musRank } from '@31mus/engine';
import { describe, expect, it } from 'vitest';

import {
  HAND_COMBOS,
  RANK_COPIES,
  binomial,
  comboKey,
  rankMultisets,
  representativeHand,
  unseenCounts,
} from './combos.js';
import { cards } from './testing/notation.js';

describe('combinaciones de figuras', () => {
  it('hay 330 combinaciones de cuatro figuras y suman las 91.390 manos posibles', () => {
    expect(HAND_COMBOS).toHaveLength(330);
    expect(HAND_COMBOS.reduce((acc, c) => acc + c.weight, 0)).toBe(binomial(40, 4));
  });

  it('pesa cada combinación por sus cartas reales: cuatro reyes salen de los 8 (reyes y treses)', () => {
    const fourKings = HAND_COMBOS.find((c) => comboKey(c.ranks) === '12-12-12-12');
    expect(fourKings?.weight).toBe(binomial(8, 4));
    const fourFours = HAND_COMBOS.find((c) => comboKey(c.ranks) === '4-4-4-4');
    expect(fourFours?.weight).toBe(1);
  });

  it('binomial fuera de rango vale 0', () => {
    expect(binomial(4, 5)).toBe(0);
    expect(binomial(4, -1)).toBe(0);
    expect(binomial(8, 2)).toBe(28);
  });

  it('la clave no depende del orden', () => {
    expect(comboKey([12, 1, 4, 12])).toBe(comboKey([4, 12, 12, 1]));
  });

  it('la mano representativa tiene esas figuras y cartas distintas', () => {
    const hand = representativeHand([12, 12, 12, 12]);
    expect(new Set(hand).size).toBe(4);
    expect(hand.map(musRank)).toEqual([12, 12, 12, 12]);
  });

  it('lo que no veo descuenta mis cartas (un tres cuenta como rey)', () => {
    const counts = unseenCounts(cards('3o Rc 4e 2b'));
    expect(counts[12]).toBe(RANK_COPIES[12] - 2);
    expect(counts[4]).toBe(3);
    expect(counts[1]).toBe(7);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(36);
  });

  it('los robos de k cartas suman todas las formas de elegirlas', () => {
    const counts = unseenCounts(cards('Ro Rc Re Rb'));
    for (const k of [1, 2, 3, 4]) {
      const total = rankMultisets(k, counts).reduce((acc, c) => acc + c.weight, 0);
      expect(total).toBe(binomial(36, k));
    }
  });
});
