/**
 * Recorre la tabla de casos de `docs/engine/CASOS_EVALUACION.md` (ADR-0002 §10): la tabla es la
 * fuente de verdad, revisada por Antonio; este test comprueba que el motor coincide con ella.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { Card } from '../cards.js';
import { SEATS, teamOf } from '../seat.js';
import type { PerSeat, Seat } from '../seat.js';
import { card } from '../testing/notation.js';
import { LANCES, anyJuego, jugadaPoints, lanceWinner } from './lances.js';
import type { Lance } from './lances.js';

const TABLE_PATH = fileURLToPath(
  new URL('../../../../docs/engine/CASOS_EVALUACION.md', import.meta.url),
);
const MIN_CASES = 60;

interface Case {
  readonly id: string;
  readonly lance: Lance;
  readonly mano: Seat;
  readonly hands: PerSeat<readonly Card[]>;
  readonly winner: Seat | null;
  readonly points: number | null;
}

function parseCard(token: string, id: string): Card {
  try {
    return card(token);
  } catch {
    throw new Error(`${id}: carta no válida «${token}».`);
  }
}

function parseSeat(value: string, id: string): Seat | null {
  if (value === '—') return null;
  const seat = SEATS.find((s) => String(s) === value);
  if (seat === undefined) throw new Error(`${id}: asiento no válido «${value}».`);
  return seat;
}

function parseCases(markdown: string): Case[] {
  return markdown
    .split('\n')
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((cells) => /^[A-Z]\d{2}$/.test(cells[1] ?? ''))
    .map((cells) => {
      const [
        ,
        id = '',
        lance = '',
        mano = '',
        j0 = '',
        j1 = '',
        j2 = '',
        j3 = '',
        gana = '',
        tantos = '',
      ] = cells;
      const lanceValue = LANCES.find((l) => l === lance);
      const manoSeat = parseSeat(mano, id);
      if (lanceValue === undefined || manoSeat === null) {
        throw new Error(`${id}: lance o mano no válidos.`);
      }
      const hand = (text: string) => text.split(/\s+/).map((t) => parseCard(t, id));
      return {
        id,
        lance: lanceValue,
        mano: manoSeat,
        hands: [hand(j0), hand(j1), hand(j2), hand(j3)],
        winner: parseSeat(gana, id),
        points: tantos === '—' ? null : Number(tantos),
      };
    });
}

const cases = parseCases(readFileSync(TABLE_PATH, 'utf8'));

describe('tabla de casos de evaluación', () => {
  it(`tiene al menos ${String(MIN_CASES)} casos con identificador único`, () => {
    expect(cases.length).toBeGreaterThanOrEqual(MIN_CASES);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });

  it.each(cases)('$id', ({ id, lance, mano, hands, winner, points }) => {
    const cards = hands.flat();
    expect(cards, `${id}: 16 cartas distintas`).toHaveLength(16);
    expect(new Set(cards).size, `${id}: 16 cartas distintas`).toBe(16);
    expect(hands.every((h) => h.length === 4)).toBe(true);
    if (lance === 'punto')
      expect(anyJuego(hands), `${id}: el punto exige que nadie tenga juego`).toBe(false);

    const actual = lanceWinner(lance, hands, mano);
    expect(actual).toBe(winner);
    const expectedPoints =
      actual === null || lance === 'grande' || lance === 'chica'
        ? null
        : jugadaPoints(lance, hands, teamOf(actual));
    expect(expectedPoints).toBe(points);
  });
});
