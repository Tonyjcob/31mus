/**
 * Juego y punto (REGLAS_MUS.md §4.4–4.5). Hay juego con 31 o más.
 * Orden de juego, de mejor a peor: 31 > 32 > 40 > 37 > 36 > 35 > 34 > 33. Todas las 31 valen
 * lo mismo (no hay 31 real). Si nadie tiene juego, se juega al punto: gana la suma más alta.
 */
import { cardPoints } from '../cards.js';
import type { Card } from '../cards.js';
import { JUEGO_31_POINTS, JUEGO_MIN, JUEGO_POINTS } from '../rules.js';

/** Suma de la mano para juego y punto. */
export function handPoints(hand: readonly Card[]): number {
  return hand.reduce((acc, card) => acc + cardPoints(card), 0);
}

/** La suma de la mano si tiene juego, o `null` si no. */
export function juegoKey(hand: readonly Card[]): number | null {
  const points = handPoints(hand);
  return points >= JUEGO_MIN ? points : null;
}

/** Juegos posibles de mejor a peor (§4.4). 38 y 39 no pueden darse con 4 cartas. */
export const JUEGO_ORDER = [31, 32, 40, 37, 36, 35, 34, 33] as const;

/** Posición en el orden de juego: 0 es la mejor (31). */
function juegoOrder(points: number): number {
  const index = JUEGO_ORDER.findIndex((p) => p === points);
  if (index === -1) {
    // Invariante: solo se compara una suma que tiene juego.
    throw new RangeError(`Suma sin juego (${String(points)}).`);
  }
  return index;
}

export function compareJuego(a: number, b: number): number {
  return juegoOrder(b) - juegoOrder(a);
}

/** Tantos del juego en el recuento: la 31 vale 3 y cualquier otro juego 2. */
export function juegoPoints(points: number): number {
  return points === JUEGO_MIN ? JUEGO_31_POINTS : JUEGO_POINTS;
}

/** Punto: gana la suma más alta. */
export function comparePunto(a: number, b: number): number {
  return a - b;
}
