import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createSeededRng, shuffle, xoshiro128ss } from './rng.js';

function draw(seed: number, bound: number, count: number): number[] {
  const rng = createSeededRng(seed);
  return Array.from({ length: count }, () => rng.nextInt(bound));
}

describe('xoshiro128ss', () => {
  it('coincide con el vector de referencia para el estado [1, 2, 3, 4]', () => {
    const next = xoshiro128ss([1, 2, 3, 4]);
    expect([next(), next(), next()]).toEqual([11520, 0, 5927040]);
  });
});

describe('createSeededRng', () => {
  it('es reproducible: la misma semilla da la misma secuencia', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        expect(draw(seed, 1000, 20)).toEqual(draw(seed, 1000, 20));
      }),
    );
  });

  it('semillas distintas dan secuencias distintas', () => {
    expect(draw(1, 2 ** 32, 8)).not.toEqual(draw(2, 2 ** 32, 8));
  });

  it('la secuencia de la semilla 31 no cambia (las repeticiones de partidas dependen de ello)', () => {
    // Valores fijados al implementar xoshiro128**: si este test falla, el algoritmo cambió.
    expect(draw(31, 100, 10)).toMatchInlineSnapshot(`
      [
        10,
        72,
        88,
        20,
        74,
        95,
        86,
        62,
        43,
        2,
      ]
    `);
  });

  it('devuelve enteros en [0, bound)', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 2 ** 32 }), (seed, bound) => {
        for (const n of draw(seed, bound, 10)) {
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThan(bound);
        }
      }),
    );
  });

  it('con bound = 1 siempre devuelve 0', () => {
    expect(draw(7, 1, 5)).toEqual([0, 0, 0, 0, 0]);
  });

  it('reparte de forma aproximadamente uniforme (χ² con 9 grados de libertad)', () => {
    const bound = 10;
    const samples = 100_000;
    const counts = new Array<number>(bound).fill(0);
    for (const n of draw(2026, bound, samples)) {
      counts[n] = (counts[n] ?? 0) + 1;
    }
    const expected = samples / bound;
    const chi2 = counts.reduce((acc, c) => acc + (c - expected) ** 2 / expected, 0);
    // Valor crítico para p = 0,001 con 9 g. l.: 27,88. Semilla fija: el test es determinista.
    expect(chi2).toBeLessThan(27.88);
  });

  it('rechaza límites no válidos (error de programación)', () => {
    const rng = createSeededRng(0);
    for (const bound of [0, -1, 1.5, Number.NaN, 2 ** 32 + 1]) {
      expect(() => rng.nextInt(bound)).toThrow(RangeError);
    }
  });
});

describe('shuffle', () => {
  it('devuelve una permutación de la entrada sin mutarla', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), fc.integer(), (items, seed) => {
        const frozen = Object.freeze([...items]);
        const result = shuffle(frozen, createSeededRng(seed));
        expect(frozen).toEqual(items);
        expect([...result].sort((a, b) => a - b)).toEqual([...items].sort((a, b) => a - b));
      }),
    );
  });

  it('cada posición recibe cada elemento con frecuencia similar', () => {
    const rng = createSeededRng(99);
    const size = 4;
    const runs = 40_000;
    const counts = Array.from({ length: size }, () => new Array<number>(size).fill(0));
    for (let r = 0; r < runs; r++) {
      shuffle([0, 1, 2, 3], rng).forEach((value, position) => {
        const row = counts[position];
        if (row) row[value] = (row[value] ?? 0) + 1;
      });
    }
    for (const row of counts) {
      for (const c of row) {
        expect(Math.abs(c - runs / size)).toBeLessThan(runs * 0.02);
      }
    }
  });
});
