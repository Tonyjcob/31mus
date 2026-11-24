import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { FULL_DECK } from '../cards.js';
import type { Card } from '../cards.js';
import { shuffledDeck } from '../deck.js';
import { createSeededRng } from '../rng.js';
import { SEATS } from '../seat.js';
import type { Seat } from '../seat.js';
import { chicaKey, compareChica, compareGrande, grandeKey } from './grande-chica.js';
import {
  JUEGO_ORDER,
  compareJuego,
  comparePunto,
  handPoints,
  juegoKey,
  juegoPoints,
} from './juego-punto.js';
import { comparePares, paresKey, paresPoints } from './pares.js';
import { compareLexicographic, resolveLance } from './resolve-lance.js';

const handArb = fc.shuffledSubarray([...FULL_DECK], { minLength: 4, maxLength: 4 });
/** Comprueba que `compare(a, b)` y `compare(b, a)` tienen signos opuestos (o los dos son 0). */
function expectAntisymmetric(ab: number, ba: number): void {
  expect(Math.sign(ab) + Math.sign(ba)).toBe(0);
}

describe('resolveLance', () => {
  const entries = (keys: readonly number[]) => keys.map((key, i) => ({ seat: i as Seat, key }));
  const byValue = (a: number, b: number) => a - b;

  it('gana la mejor clave', () => {
    expect(resolveLance(entries([3, 9, 5, 1]), byValue, 0)).toBe(1);
  });

  it('en empate gana el más cercano a la mano', () => {
    expect(resolveLance(entries([9, 9, 9, 9]), byValue, 0)).toBe(0);
    expect(resolveLance(entries([9, 9, 9, 9]), byValue, 2)).toBe(2);
    expect(resolveLance(entries([1, 9, 1, 9]), byValue, 2)).toBe(3);
    expect(resolveLance(entries([1, 9, 1, 9]), byValue, 0)).toBe(1);
  });

  it('solo considera a los que participan y devuelve null si no hay nadie', () => {
    expect(resolveLance([{ seat: 3, key: 1 }], byValue, 0)).toBe(3);
    expect(resolveLance([], byValue, 0)).toBeNull();
  });

  it('el resultado no depende del orden de las entradas', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 4, maxLength: 4 }),
        fc.constantFrom<Seat>(...SEATS),
        (keys, mano) => {
          const list = entries(keys);
          expect(resolveLance([...list].reverse(), byValue, mano)).toBe(
            resolveLance(list, byValue, mano),
          );
        },
      ),
    );
  });

  it('compareLexicographic compara posición a posición', () => {
    expect(compareLexicographic([12, 7, 1, 1], [12, 6, 12, 12])).toBeGreaterThan(0);
    expect(compareLexicographic([1, 12, 12, 12], [4, 1, 1, 1])).toBeLessThan(0);
    expect(compareLexicographic([4, 4, 1, 1], [4, 4, 1, 1])).toBe(0);
  });
});

describe('grande y chica', () => {
  it('ordenan con la equivalencia de 8 reyes', () => {
    expect(grandeKey(['oros-3', 'oros-2', 'copas-11', 'oros-7'])).toEqual([12, 11, 7, 1]);
    expect(chicaKey(['oros-3', 'oros-2', 'copas-11', 'oros-7'])).toEqual([1, 7, 11, 12]);
  });

  it('la grande prefiere lo alto y la chica lo bajo', () => {
    const high: Card[] = ['oros-12', 'copas-12', 'oros-7', 'oros-4'];
    const low: Card[] = ['oros-1', 'copas-1', 'oros-5', 'oros-6'];
    expect(compareGrande(grandeKey(high), grandeKey(low))).toBeGreaterThan(0);
    expect(compareChica(chicaKey(low), chicaKey(high))).toBeGreaterThan(0);
  });

  it('las comparaciones son antisimétricas', () => {
    fc.assert(
      fc.property(handArb, handArb, (a, b) => {
        expectAntisymmetric(
          compareGrande(grandeKey(a), grandeKey(b)),
          compareGrande(grandeKey(b), grandeKey(a)),
        );
        expectAntisymmetric(
          compareChica(chicaKey(a), chicaKey(b)),
          compareChica(chicaKey(b), chicaKey(a)),
        );
      }),
    );
  });
});

describe('pares', () => {
  it('reconoce cada jugada', () => {
    expect(paresKey(['oros-12', 'copas-3', 'oros-7', 'oros-4'])).toEqual({
      kind: 'pareja',
      high: 12,
      low: 12,
    });
    expect(paresKey(['oros-1', 'copas-2', 'espadas-1', 'oros-4'])).toEqual({
      kind: 'medias',
      high: 1,
      low: 1,
    });
    expect(paresKey(['oros-5', 'copas-5', 'oros-10', 'copas-10'])).toEqual({
      kind: 'duples',
      high: 10,
      low: 5,
    });
    expect(paresKey(['oros-6', 'copas-6', 'espadas-6', 'bastos-6'])).toEqual({
      kind: 'duples',
      high: 6,
      low: 6,
    });
    expect(paresKey(['oros-12', 'oros-11', 'oros-10', 'oros-7'])).toBeNull();
  });

  it('vale 1, 2 o 3 en el recuento', () => {
    expect(paresPoints({ kind: 'pareja', high: 4, low: 4 })).toBe(1);
    expect(paresPoints({ kind: 'medias', high: 4, low: 4 })).toBe(2);
    expect(paresPoints({ kind: 'duples', high: 4, low: 1 })).toBe(3);
  });

  it('la comparación es antisimétrica', () => {
    fc.assert(
      fc.property(handArb, handArb, (a, b) => {
        const ka = paresKey(a);
        const kb = paresKey(b);
        if (ka === null || kb === null) return;
        expectAntisymmetric(comparePares(ka, kb), comparePares(kb, ka));
      }),
    );
  });
});

describe('juego y punto', () => {
  it('hay juego desde 31', () => {
    expect(juegoKey(['oros-12', 'oros-11', 'oros-10', 'oros-1'])).toBe(31);
    expect(juegoKey(['oros-12', 'oros-11', 'oros-7', 'oros-1'])).toBeNull();
    expect(handPoints(['oros-12', 'oros-11', 'oros-7', 'oros-1'])).toBe(28);
  });

  it('sigue el orden 31 > 32 > 40 > 37 > 36 > 35 > 34 > 33', () => {
    for (let i = 0; i < JUEGO_ORDER.length - 1; i++) {
      const better = JUEGO_ORDER[i] ?? 0;
      const worse = JUEGO_ORDER[i + 1] ?? 0;
      expect(compareJuego(better, worse)).toBeGreaterThan(0);
      expect(compareJuego(worse, better)).toBeLessThan(0);
    }
    expect(compareJuego(31, 31)).toBe(0);
  });

  it('toda suma con juego de una mano real está en el orden', () => {
    const rng = createSeededRng(4);
    for (let i = 0; i < 2000; i++) {
      const points = handPoints(shuffledDeck(rng).slice(0, 4));
      if (points >= 31) expect(JUEGO_ORDER).toContain(points);
    }
  });

  it('comparar una suma sin juego es un error de programación', () => {
    expect(() => compareJuego(38, 31)).toThrow(RangeError);
  });

  it('la 31 vale 3 tantos y el resto de juegos 2', () => {
    expect(juegoPoints(31)).toBe(3);
    for (const points of JUEGO_ORDER.slice(1)) expect(juegoPoints(points)).toBe(2);
  });

  it('en el punto gana la suma más alta', () => {
    expect(comparePunto(30, 29)).toBeGreaterThan(0);
    expect(comparePunto(4, 4)).toBe(0);
  });
});
