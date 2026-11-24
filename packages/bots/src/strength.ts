/**
 * Fuerza de una mano en cada lance (ADR-0003 §2): qué fracción de las manos posibles le gana,
 * empata o pierde. Se calcula una vez al cargar el módulo, comparando las 330 combinaciones de
 * figuras entre sí con los evaluadores del motor.
 */
import {
  chicaKey,
  compareChica,
  compareGrande,
  compareJuego,
  comparePares,
  comparePunto,
  grandeKey,
  handPoints,
  juegoKey,
  paresKey,
} from '@31mus/engine';
import type { Card, Lance } from '@31mus/engine';

import { HAND_COMBOS, comboKey, handRanks, representativeHand } from './combos.js';

/** Posición de una mano frente a una mano rival al azar de las que juegan el lance. */
export interface LanceStats {
  /** Fracción de esas manos a las que gana. */
  readonly beat: number;
  /** Fracción con la que empata (el empate lo gana quien está más cerca de la mano). */
  readonly tie: number;
}

/** Cómo se evalúa un lance: clave, comparación y quién lo juega. */
interface LanceRule<K> {
  readonly key: (hand: readonly Card[]) => K | null;
  readonly compare: (a: K, b: K) => number;
}

function rule<K>(
  key: (hand: readonly Card[]) => K | null,
  compare: (a: K, b: K) => number,
): LanceRule<unknown> {
  return { key, compare } as LanceRule<unknown>;
}

const RULES: Readonly<Record<Lance, LanceRule<unknown>>> = {
  grande: rule(grandeKey, compareGrande),
  chica: rule(chicaKey, compareChica),
  pares: rule(paresKey, comparePares),
  juego: rule(juegoKey, compareJuego),
  // Al punto solo se juega si nadie tiene juego: las manos que cuentan son las que no lo tienen.
  punto: rule((hand) => (juegoKey(hand) === null ? handPoints(hand) : null), comparePunto),
};

interface LanceTable {
  readonly stats: ReadonlyMap<string, LanceStats>;
  /** Fracción de todas las manos que juegan el lance. */
  readonly share: number;
}

function buildTable(lanceRule: LanceRule<unknown>): LanceTable {
  const entries = HAND_COMBOS.flatMap(({ ranks, weight }) => {
    const key = lanceRule.key(representativeHand(ranks));
    return key === null ? [] : [{ combo: comboKey(ranks), key, weight }];
  });
  const total = HAND_COMBOS.reduce((acc, { weight }) => acc + weight, 0);
  const population = entries.reduce((acc, { weight }) => acc + weight, 0);
  const stats = new Map<string, LanceStats>();
  for (const own of entries) {
    let beat = 0;
    let tie = 0;
    for (const other of entries) {
      const result = lanceRule.compare(own.key, other.key);
      if (result > 0) beat += other.weight;
      else if (result === 0) tie += other.weight;
    }
    stats.set(own.combo, { beat: beat / population, tie: tie / population });
  }
  return { stats, share: population / total };
}

const TABLES: Readonly<Record<Lance, LanceTable>> = {
  grande: buildTable(RULES.grande),
  chica: buildTable(RULES.chica),
  pares: buildTable(RULES.pares),
  juego: buildTable(RULES.juego),
  punto: buildTable(RULES.punto),
};

/**
 * Fuerza de `hand` en `lance` frente a una mano rival al azar de las que juegan ese lance, o `null`
 * si la mano no lo juega (pares sin pares, juego sin juego, punto con juego).
 */
export function lanceStats(lance: Lance, hand: readonly Card[]): LanceStats | null {
  return TABLES[lance].stats.get(comboKey(handRanks(hand))) ?? null;
}

/** Fracción de todas las manos que juegan `lance` (en pares, las que tienen pares…). */
export function lanceShare(lance: Lance): number {
  return TABLES[lance].share;
}
