/**
 * Probabilidad de que una pareja gane un lance (ADR-0003 §2). Se resume cada mano en un número
 * `u` de [0, 1]: la probabilidad de ganar a una mano rival al azar de las que juegan el lance,
 * contando los empates según la posición. Las manos de los demás se tratan como independientes y
 * uniformes en ese mismo sentido, y la del compañero puede acotarse por lo que ha hecho.
 */
import { distanceFromMano, nextSeat, partnerOf } from '@31mus/engine';
import type { Seat } from '@31mus/engine';

import type { LanceStats } from './strength.js';

/** Lo que se sabe de la mano del compañero, en la misma escala que `u`. */
export interface Range {
  readonly low: number;
  readonly high: number;
}

/** Sin información: cualquier mano. */
export const ANY_HAND: Range = { low: 0, high: 1 };

/**
 * Fracción de los empates con un rival que gana `seat`: la mano gana los empates con los dos
 * rivales, el postre no gana ninguno y el segundo y el tercero ganan uno de cada dos.
 */
export function tieShare(seat: Seat, mano: Seat): number {
  const rivals = [nextSeat(seat), nextSeat(partnerOf(seat))];
  const mine = distanceFromMano(seat, mano);
  const farther = rivals.filter((rival) => distanceFromMano(rival, mano) > mine).length;
  return farther / rivals.length;
}

/** `u` de una mano: gana a una mano rival al azar, contando su parte de los empates. */
export function edge(stats: LanceStats, ties: number): number {
  return stats.beat + stats.tie * ties;
}

/**
 * Probabilidad de que la mejor mano de la pareja gane a las de `rivals` rivales (0, 1 o 2), si la
 * propia vale `u` y la del compañero está en `partner` (o `null` si no juega el lance):
 * E[max(u, V)^rivals] con V uniforme en el rango del compañero.
 */
export function teamWin(u: number, partner: Range | null, rivals: number): number {
  const power = (x: number) => x ** rivals;
  if (partner === null) return power(u);
  const { low, high } = partner;
  if (high <= u) return power(u);
  const antiderivative = (x: number) => x ** (rivals + 1) / (rivals + 1);
  if (high - low <= 0) return power(Math.max(u, high));
  // Por debajo de u manda la propia mano; por encima, la del compañero.
  const ownPart = Math.max(0, u - low) * power(u);
  const partnerPart = antiderivative(high) - antiderivative(Math.max(u, low));
  return (ownPart + partnerPart) / (high - low);
}

/** Puntos de la integral numérica de `winProbability`. */
const INTEGRATION_STEPS = 64;

/** Probabilidad de que una mano al azar de `range` quede por debajo de `x`. */
function below(range: Range, x: number): number {
  if (x <= range.low) return 0;
  if (x >= range.high) return 1;
  return (x - range.low) / (range.high - range.low);
}

/**
 * Como `teamWin`, pero cada rival puede tener su propio rango (por ejemplo, el que acaba de
 * envidar tiene, en principio, buena mano). Integra numéricamente sobre la mano del compañero.
 */
export function winProbability(u: number, partner: Range | null, rivals: readonly Range[]): number {
  const beatsAll = (x: number) => rivals.reduce((acc, rival) => acc * below(rival, x), 1);
  if (partner === null || partner.high <= partner.low) {
    return beatsAll(Math.max(u, partner?.high ?? 0));
  }
  const width = (partner.high - partner.low) / INTEGRATION_STEPS;
  let total = 0;
  for (let i = 0; i < INTEGRATION_STEPS; i++) {
    total += beatsAll(Math.max(u, partner.low + (i + 0.5) * width));
  }
  return total / INTEGRATION_STEPS;
}
