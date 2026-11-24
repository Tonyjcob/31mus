/**
 * Baraja española de 40 cartas (REGLAS_MUS.md §1). Una carta es una cadena `palo-número`
 * (p. ej. `'oros-12'`, `'copas-3'`): se compara con `===` y ocupa poco en JSON (ADR-0002 §6).
 * La carta conserva su número real; la equivalencia de 8 reyes se aplica al evaluar.
 */
export const SUITS = ['oros', 'copas', 'espadas', 'bastos'] as const;
export type Suit = (typeof SUITS)[number];

/** Números de la baraja: sota = 10, caballo = 11, rey = 12. */
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;
export type Rank = (typeof RANKS)[number];

export type Card = `${Suit}-${Rank}`;

/** Rango a efectos del mus a 8 reyes: el 3 es rey y el 2 es as (§1.1). */
export type MusRank = Exclude<Rank, 2 | 3>;

/** Rangos de mus de menor a mayor: `A < 4 < 5 < 6 < 7 < S < C < R` (§1.1). */
export const MUS_RANKS = [1, 4, 5, 6, 7, 10, 11, 12] as const satisfies readonly MusRank[];

/** Las 40 cartas, en orden fijo (palo y número). */
export const FULL_DECK: readonly Card[] = SUITS.flatMap((suit) =>
  RANKS.map((rank): Card => `${suit}-${String(rank)}` as Card),
);

interface ParsedCard {
  readonly suit: Suit;
  readonly rank: Rank;
}

const PARSED: ReadonlyMap<string, ParsedCard> = new Map(
  SUITS.flatMap((suit) =>
    RANKS.map((rank) => [`${suit}-${String(rank)}`, { suit, rank }] as const),
  ),
);

function parse(card: Card): ParsedCard {
  const parsed = PARSED.get(card);
  if (parsed === undefined) {
    // Imposible con el tipo `Card`; solo si alguien se salta el sistema de tipos.
    throw new TypeError('Carta no válida.');
  }
  return parsed;
}

/** Comprueba si un valor externo es una carta válida. */
export function isCard(value: unknown): value is Card {
  return typeof value === 'string' && PARSED.has(value);
}

export function cardSuit(card: Card): Suit {
  return parse(card).suit;
}

export function cardRank(card: Card): Rank {
  return parse(card).rank;
}

/** Rango para grande, chica y pares: el 3 cuenta como rey y el 2 como as (§1.1). */
export function musRank(card: Card): MusRank {
  const rank = cardRank(card);
  if (rank === 3) return 12;
  if (rank === 2) return 1;
  return rank;
}

/** Valor para juego y punto: figuras 10, 4–7 su número, as 1 (§1.2). */
export function cardPoints(card: Card): number {
  const rank = musRank(card);
  return rank >= 10 ? 10 : rank;
}
