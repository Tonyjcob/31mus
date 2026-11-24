import { distanceFromMano } from '../seat.js';
import type { Seat } from '../seat.js';

/** Compara dos claves de un lance: positivo si `a` es mejor, negativo si es peor, 0 si empatan. */
export type Compare<K> = (a: K, b: K) => number;

export interface LanceEntry<K> {
  readonly seat: Seat;
  readonly key: K;
}

/**
 * Ganador de un lance entre los jugadores que participan. Los empates los gana el jugador más
 * cercano a la mano, en orden de juego (REGLAS_MUS.md §2). `null` si no participa nadie.
 */
export function resolveLance<K>(
  entries: readonly LanceEntry<K>[],
  compare: Compare<K>,
  mano: Seat,
): Seat | null {
  const byPriority = [...entries].sort(
    (a, b) => distanceFromMano(a.seat, mano) - distanceFromMano(b.seat, mano),
  );
  let best: LanceEntry<K> | null = null;
  for (const entry of byPriority) {
    // Solo un jugador más lejano de la mano que gane estrictamente desbanca al actual.
    if (best === null || compare(entry.key, best.key) > 0) {
      best = entry;
    }
  }
  return best?.seat ?? null;
}

/** Mayor que cualquier rango (el rey es 12): cada rango es una cifra en base 13. */
const RANK_BASE = 13;

function encode(ranks: readonly number[]): number {
  return ranks.reduce((acc, rank) => acc * RANK_BASE + rank, 0);
}

/**
 * Compara dos listas de rangos **de la misma longitud** posición a posición: positivo si `a` es
 * mayor. Leídas como números en base 13, el orden numérico es el lexicográfico.
 */
export function compareLexicographic(a: readonly number[], b: readonly number[]): number {
  return encode(a) - encode(b);
}
