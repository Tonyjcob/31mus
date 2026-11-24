/**
 * Combinaciones de figuras de mus (ADR-0003 §2). El palo no cuenta en ningún lance: una mano queda
 * definida por sus cuatro figuras (A, 4, 5, 6, 7, S, C, R). Hay 330 combinaciones de cuatro, que
 * entre todas suman las 91.390 manos posibles de la baraja.
 */
import { FULL_DECK, MUS_RANKS, musRank } from '@31mus/engine';
import type { Card, MusRank } from '@31mus/engine';

/** Copias de cada figura en la baraja: los doses cuentan como ases y los treses como reyes. */
export const RANK_COPIES: Readonly<Record<MusRank, number>> = {
  1: 8,
  4: 4,
  5: 4,
  6: 4,
  7: 4,
  10: 4,
  11: 4,
  12: 8,
};

export type RankCounts = Readonly<Record<MusRank, number>>;

/** Un conjunto de figuras (con repeticiones) y cuántas combinaciones de cartas reales lo forman. */
export interface WeightedRanks {
  /** Figuras en orden ascendente. */
  readonly ranks: readonly MusRank[];
  readonly weight: number;
}

/** Combinaciones de `k` elementos entre `n`. */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return result;
}

/**
 * Todos los conjuntos de `size` figuras que se pueden sacar de `counts`, con su peso: el número de
 * maneras de elegir esas cartas concretas.
 */
export function rankMultisets(size: number, counts: RankCounts): WeightedRanks[] {
  const result: WeightedRanks[] = [];
  const walk = (from: number, left: number, ranks: MusRank[], weight: number): void => {
    if (left === 0) {
      result.push({ ranks, weight });
      return;
    }
    MUS_RANKS.slice(from).forEach((rank, offset) => {
      for (let taken = 1; taken <= Math.min(left, counts[rank]); taken++) {
        const next = [...ranks, ...Array<MusRank>(taken).fill(rank)];
        walk(from + offset + 1, left - taken, next, weight * binomial(counts[rank], taken));
      }
    });
  };
  walk(0, size, [], 1);
  return result;
}

/** Clave de una combinación: sus figuras ordenadas. */
export function comboKey(ranks: readonly MusRank[]): string {
  return [...ranks].sort((a, b) => a - b).join('-');
}

export function handRanks(hand: readonly Card[]): MusRank[] {
  return hand.map(musRank);
}

/** Una mano real con esas figuras (cartas distintas para las figuras repetidas). */
export function representativeHand(ranks: readonly MusRank[]): Card[] {
  return [...new Set(ranks)].flatMap((rank) =>
    FULL_DECK.filter((card) => musRank(card) === rank).slice(
      0,
      ranks.filter((r) => r === rank).length,
    ),
  );
}

/** Las 330 combinaciones de cuatro figuras, con su peso sobre las 91.390 manos. */
export const HAND_COMBOS: readonly WeightedRanks[] = rankMultisets(4, RANK_COPIES);

/** Copias que quedan de cada figura sin contar las de `hand` (lo que no veo). */
export function unseenCounts(hand: readonly Card[]): RankCounts {
  const counts = { ...RANK_COPIES };
  for (const rank of handRanks(hand)) counts[rank] -= 1;
  return counts;
}
