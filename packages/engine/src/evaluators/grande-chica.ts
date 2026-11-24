/**
 * Grande y chica (REGLAS_MUS.md §4.1–4.2): se ordenan las 4 cartas por rango de mus y se comparan
 * posición a posición. Grande: de mayor a menor, gana la más alta. Chica: de menor a mayor, gana
 * la más baja.
 */
import { musRank } from '../cards.js';
import type { Card, MusRank } from '../cards.js';
import { compareLexicographic } from './resolve-lance.js';

export type GrandeKey = readonly MusRank[];
export type ChicaKey = readonly MusRank[];

export function grandeKey(hand: readonly Card[]): GrandeKey {
  return hand.map(musRank).sort((a, b) => b - a);
}

export function compareGrande(a: GrandeKey, b: GrandeKey): number {
  return compareLexicographic(a, b);
}

export function chicaKey(hand: readonly Card[]): ChicaKey {
  return hand.map(musRank).sort((a, b) => a - b);
}

/** Positivo si `a` es mejor chica, es decir, más baja. */
export function compareChica(a: ChicaKey, b: ChicaKey): number {
  return compareLexicographic(b, a);
}
