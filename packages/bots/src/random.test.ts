import { createSeededRng } from '@31mus/engine';
import type { Action } from '@31mus/engine';
import { describe, expect, it } from 'vitest';

import { randomAction } from './random.js';
import { pairs, randomPlayer, simulateMatch } from './testing/simulate.js';

describe('randomAction', () => {
  const legal: Action[] = [{ type: 'paso' }, { type: 'envido', amount: 2 }, { type: 'ordago' }];

  it('elige siempre una acción legal y todas acaban saliendo', () => {
    const rng = createSeededRng(1);
    const seen = new Set(Array.from({ length: 100 }, () => randomAction(legal, rng).type));
    expect(seen).toEqual(new Set(['paso', 'envido', 'ordago']));
  });

  it('sin acciones legales es un error de programación', () => {
    expect(() => randomAction([], createSeededRng(1))).toThrow(RangeError);
  });
});

describe('partidas entre bots aleatorios', () => {
  it('terminan y siempre gana una pareja', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { winner, hands, stats } = simulateMatch(pairs(randomPlayer, randomPlayer), seed);
      expect([0, 1]).toContain(winner);
      expect(hands).toBeGreaterThan(0);
      expect(stats[0].decisions + stats[1].decisions).toBeGreaterThan(0);
    }
  });
});
