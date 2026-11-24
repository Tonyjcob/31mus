import type { Action } from '@31mus/engine';
import { describe, expect, it } from 'vitest';

import { closestAmount, findAction, requireAction, requireAmount } from './choose.js';

const legal: Action[] = [
  { type: 'quiero' },
  { type: 'reenvido', amount: 2 },
  { type: 'reenvido', amount: 4 },
  { type: 'reenvido', amount: 6 },
];

describe('elegir entre las acciones legales', () => {
  it('encuentra una acción por tipo o devuelve null', () => {
    expect(findAction(legal, 'quiero')).toEqual({ type: 'quiero' });
    expect(findAction(legal, 'paso')).toBeNull();
  });

  it('requireAction falla si las reglas no la permiten', () => {
    expect(requireAction(legal, 'quiero')).toEqual({ type: 'quiero' });
    expect(() => requireAction(legal, 'paso')).toThrow(RangeError);
  });

  it('elige la cantidad más cercana y, a igualdad, la menor', () => {
    expect(closestAmount(legal, 'reenvido', 5)).toEqual({ type: 'reenvido', amount: 4 });
    expect(closestAmount(legal, 'reenvido', 3)).toEqual({ type: 'reenvido', amount: 2 });
    expect(closestAmount(legal, 'reenvido', 40)).toEqual({ type: 'reenvido', amount: 6 });
    expect(closestAmount(legal, 'envido', 2)).toBeNull();
  });

  it('requireAmount falla si no hay ninguna cantidad legal', () => {
    expect(requireAmount(legal, 'reenvido', 1)).toEqual({ type: 'reenvido', amount: 2 });
    expect(() => requireAmount(legal, 'envido', 2)).toThrow(RangeError);
  });
});
