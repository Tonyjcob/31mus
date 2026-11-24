/**
 * Resolución de cada lance a partir de las cuatro manos (REGLAS_MUS.md §4): quién juega, quién
 * gana y cuánto valen las jugadas de la pareja ganadora en el recuento (sin envites).
 */
import type { Card } from '../cards.js';
import { PUNTO_POINTS } from '../rules.js';
import { SEATS, partnerOf } from '../seat.js';
import type { PerSeat, Seat } from '../seat.js';
import { chicaKey, compareChica, compareGrande, grandeKey } from './grande-chica.js';
import { compareJuego, comparePunto, handPoints, juegoKey, juegoPoints } from './juego-punto.js';
import { comparePares, paresKey, paresPoints } from './pares.js';
import { resolveLance } from './resolve-lance.js';
import type { Compare, LanceEntry } from './resolve-lance.js';

export const LANCES = ['grande', 'chica', 'pares', 'juego', 'punto'] as const;
export type Lance = (typeof LANCES)[number];

type Hands = PerSeat<readonly Card[]>;

function sum(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

function entries<K>(hands: Hands, key: (hand: readonly Card[]) => K | null): LanceEntry<K>[] {
  return SEATS.flatMap((seat) => {
    const k = key(hands[seat]);
    return k === null ? [] : [{ seat, key: k }];
  });
}

function winner<K>(
  hands: Hands,
  key: (hand: readonly Card[]) => K | null,
  compare: Compare<K>,
  mano: Seat,
): Seat | null {
  return resolveLance(entries(hands, key), compare, mano);
}

/** Asientos con jugada en el lance: en pares y juego, solo quien la tiene; si no, todos (§4). */
export function lancePlayers(lance: Lance, hands: Hands): readonly Seat[] {
  switch (lance) {
    case 'pares':
      return SEATS.filter((seat) => paresKey(hands[seat]) !== null);
    case 'juego':
      return SEATS.filter((seat) => juegoKey(hands[seat]) !== null);
    case 'grande':
    case 'chica':
    case 'punto':
      return SEATS;
  }
}

/** Si alguien tiene juego (si no, se juega al punto, §4.5). */
export function anyJuego(hands: Hands): boolean {
  return lancePlayers('juego', hands).length > 0;
}

/** Asiento que gana el lance, o `null` si nadie tiene jugada (pares o juego). */
export function lanceWinner(lance: Lance, hands: Hands, mano: Seat): Seat | null {
  switch (lance) {
    case 'grande':
      return winner(hands, grandeKey, compareGrande, mano);
    case 'chica':
      return winner(hands, chicaKey, compareChica, mano);
    case 'pares':
      return winner(hands, paresKey, comparePares, mano);
    case 'juego':
      return winner(hands, juegoKey, compareJuego, mano);
    case 'punto':
      return winner(hands, handPoints, comparePunto, mano);
  }
}

/**
 * Tantos de las jugadas de la pareja de `seat` en el recuento, sin envites (§4.3–4.5):
 * pares y juego suman las jugadas de los dos; el punto vale 1; grande y chica, 0.
 */
export function jugadaPoints(lance: Lance, hands: Hands, seat: Seat): number {
  const team = [seat, partnerOf(seat)] as const;
  switch (lance) {
    case 'pares':
      return sum(
        team.map((s) => {
          const key = paresKey(hands[s]);
          return key === null ? 0 : paresPoints(key);
        }),
      );
    case 'juego':
      return sum(
        team.map((s) => {
          const key = juegoKey(hands[s]);
          return key === null ? 0 : juegoPoints(key);
        }),
      );
    case 'punto':
      return PUNTO_POINTS;
    case 'grande':
    case 'chica':
      return 0;
  }
}
