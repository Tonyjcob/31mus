/**
 * Acciones de los jugadores (ADR-0002 §4). Términos del mus en español, sin tildes.
 * «Corto y envido» no es una acción: el servidor aplica `corto` y después `envido`.
 */
import type { Card } from './cards.js';

export type BetAction =
  | { readonly type: 'paso' }
  /** Primera apuesta del lance: `amount` tantos (envido = 2). */
  | { readonly type: 'envido'; readonly amount: number }
  /** Subida: `amount` tantos más sobre la apuesta en la mesa. */
  | { readonly type: 'reenvido'; readonly amount: number }
  | { readonly type: 'quiero' }
  | { readonly type: 'noQuiero' }
  | { readonly type: 'ordago' };

export type Action =
  | { readonly type: 'mus' }
  | { readonly type: 'corto' }
  /** Cartas que se descartan, de 1 a 4. El orden no importa. */
  | { readonly type: 'discard'; readonly cards: readonly Card[] }
  | BetAction;

/** Igualdad de acciones; en los descartes se comparan las cartas como conjunto. */
export function sameAction(a: Action, b: Action): boolean {
  switch (a.type) {
    case 'discard': {
      if (b.type !== 'discard') return false;
      // Mismas cartas y ninguna repetida en ninguna de las dos: una lista con duplicados nunca
      // coincide con una legal.
      const cardsA = new Set(a.cards);
      const cardsB = new Set(b.cards);
      return (
        cardsA.size === a.cards.length &&
        cardsB.size === b.cards.length &&
        cardsA.size === cardsB.size &&
        b.cards.every((card) => cardsA.has(card))
      );
    }
    case 'envido':
    case 'reenvido':
      return b.type === a.type && b.amount === a.amount;
    case 'mus':
    case 'corto':
    case 'paso':
    case 'quiero':
    case 'noQuiero':
    case 'ordago':
      return b.type === a.type;
  }
}
