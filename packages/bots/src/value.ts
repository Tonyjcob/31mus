/**
 * Valor de una mano antes de los lances, para decidir el mus y el descarte (ADR-0003 §3): media
 * ponderada de la probabilidad de que la pareja gane cada lance, con un compañero cualquiera.
 */
import type { Card, Lance, MusRank } from '@31mus/engine';

import { comboKey, handRanks, rankMultisets, unseenCounts } from './combos.js';
import { ANY_HAND, edge, teamWin } from './odds.js';
import { lanceShare, lanceStatsOf } from './strength.js';
import { PUNTO_FACTOR, VALUE_WEIGHTS } from './tuning.js';

const RIVALS = 2;
const memo = new Map<string, number>();

/**
 * Probabilidad de que la pareja gane `lance` con un compañero cualquiera (en grande y chica juegan
 * todos: `share` = 1). En pares y juego, el rival que no juega el lance lo pierde. En punto es al
 * revés: el rival que no lo juega es porque tiene juego, y entonces gana él.
 */
function lanceWin(lance: Lance, ranks: readonly MusRank[], ties: number): number {
  const stats = lanceStatsOf(lance, ranks);
  if (stats === null) return 0;
  const share = lanceShare(lance);
  const played = share * edge(stats, ties);
  return teamWin(lance === 'punto' ? played : 1 - share + played, ANY_HAND, RIVALS);
}

/** Valor en [0, 1] de una mano de cuatro figuras, con `ties` la parte de los empates que gana. */
export function valueOfRanks(ranks: readonly MusRank[], ties: number): number {
  const key = `${comboKey(ranks)}|${String(ties)}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const juego = lanceWin('juego', ranks, ties) || PUNTO_FACTOR * lanceWin('punto', ranks, ties);
  const total =
    VALUE_WEIGHTS.grande * lanceWin('grande', ranks, ties) +
    VALUE_WEIGHTS.chica * lanceWin('chica', ranks, ties) +
    VALUE_WEIGHTS.pares * lanceWin('pares', ranks, ties) +
    VALUE_WEIGHTS.juego * juego;
  memo.set(key, total);
  return total;
}

export function handValue(hand: readonly Card[], ties: number): number {
  return valueOfRanks(handRanks(hand), ties);
}

/** Valor esperado tras descartar `discard`, promediando todo lo que se puede robar. */
export function discardValue(hand: readonly Card[], discard: readonly Card[], ties: number) {
  const kept = handRanks(hand.filter((card) => !discard.includes(card)));
  const draws = rankMultisets(discard.length, unseenCounts(hand));
  let total = 0;
  let weights = 0;
  for (const { ranks, weight } of draws) {
    total += weight * valueOfRanks([...kept, ...ranks], ties);
    weights += weight;
  }
  return total / weights;
}
