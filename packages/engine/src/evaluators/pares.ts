/**
 * Pares (REGLAS_MUS.md §4.3): pareja, medias o duples, con los rangos de mus a 8 reyes.
 * Comparación: duples > medias > pareja; a igual tipo, el rango más alto. En duples, primero la
 * pareja alta y luego la baja; 4 cartas iguales son duples de ese rango con ese rango.
 */
import { musRank } from '../cards.js';
import type { Card, MusRank } from '../cards.js';
import { PARES_POINTS } from '../rules.js';

export type ParesKind = keyof typeof PARES_POINTS;

export interface ParesKey {
  readonly kind: ParesKind;
  /** Rango de la jugada (en duples, la pareja alta). */
  readonly high: MusRank;
  /** En duples, la pareja baja; en pareja y medias, igual que `high`. */
  readonly low: MusRank;
}

const KIND_ORDER: Readonly<Record<ParesKind, number>> = { pareja: 0, medias: 1, duples: 2 };

/** La jugada de pares de una mano, o `null` si no tiene. */
export function paresKey(hand: readonly Card[]): ParesKey | null {
  const counts = new Map<MusRank, number>();
  for (const rank of hand.map(musRank)) {
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  // Grupos de 2 o más, del rango más alto al más bajo.
  const groups = [...counts.entries()].filter(([, n]) => n >= 2).sort(([a], [b]) => b - a);

  const [first, second] = groups;
  if (first === undefined) return null;
  const [high, size] = first;
  if (second !== undefined) return { kind: 'duples', high, low: second[0] };
  if (size >= 4) return { kind: 'duples', high, low: high };
  if (size === 3) return { kind: 'medias', high, low: high };
  return { kind: 'pareja', high, low: high };
}

export function comparePares(a: ParesKey, b: ParesKey): number {
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.high - b.high || a.low - b.low;
}

/** Tantos de la jugada en el recuento: pareja 1, medias 2, duples 3. */
export function paresPoints(key: ParesKey): number {
  return PARES_POINTS[key.kind];
}
