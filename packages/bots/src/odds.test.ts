import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ANY_HAND, edge, teamWin, tieShare } from './odds.js';

describe('tieShare', () => {
  it('la mano gana todos los empates, el postre ninguno, el 2.º y el 3.º la mitad', () => {
    expect(tieShare(0, 0)).toBe(1);
    expect(tieShare(1, 0)).toBe(0.5);
    expect(tieShare(2, 0)).toBe(0.5);
    expect(tieShare(3, 0)).toBe(0);
    expect(tieShare(1, 1)).toBe(1);
  });
});

describe('edge', () => {
  it('suma la parte de los empates que gana', () => {
    expect(edge({ beat: 0.5, tie: 0.2 }, 0.5)).toBeCloseTo(0.6, 10);
  });
});

describe('teamWin', () => {
  const unit = fc.double({ min: 0, max: 1, noNaN: true });

  it('sin compañero en el lance, hay que ganar a cada rival: u^n', () => {
    expect(teamWin(0.5, null, 2)).toBeCloseTo(0.25, 10);
    expect(teamWin(0.5, null, 1)).toBeCloseTo(0.5, 10);
    expect(teamWin(0.3, null, 0)).toBe(1);
  });

  it('con un compañero cualquiera: (1 + 2u³) / 3 contra dos rivales', () => {
    fc.assert(
      fc.property(unit, (u) => {
        expect(teamWin(u, ANY_HAND, 2)).toBeCloseTo((1 + 2 * u ** 3) / 3, 9);
      }),
    );
  });

  it('un compañero fuerte sube la probabilidad y uno flojo no la cambia si mi mano es mejor', () => {
    expect(teamWin(0.3, { low: 0.7, high: 1 }, 2)).toBeGreaterThan(teamWin(0.3, ANY_HAND, 2));
    expect(teamWin(0.8, { low: 0, high: 0.5 }, 2)).toBeCloseTo(0.64, 10);
    expect(teamWin(0.2, { low: 0.6, high: 0.6 }, 2)).toBeCloseTo(0.36, 10);
  });

  it('es una probabilidad que crece con la mano propia', () => {
    fc.assert(
      fc.property(unit, unit, unit, fc.integer({ min: 0, max: 2 }), (a, b, x, n) => {
        const [low, high] = a <= b ? [a, b] : [b, a];
        const p = teamWin(x, { low, high }, n);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1 + 1e-12);
        expect(teamWin(Math.min(1, x + 0.1), { low, high }, n)).toBeGreaterThanOrEqual(p - 1e-12);
      }),
    );
  });
});
