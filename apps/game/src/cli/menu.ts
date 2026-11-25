// Menú de acciones del cliente de consola: agrupa lo que el servidor declara legal (los 15
// descartes y todas las cantidades de envite) en unas pocas órdenes y traduce lo que se escribe
// a una de esas acciones legales. Nunca inventa acciones: solo elige de `legal`.
import { sameAction, type Action, type Card } from '@31mus/engine';

import { formatAction } from './format.js';

type Simple = Exclude<Action, { type: 'discard' | 'envido' | 'reenvido' }>;

export interface Menu {
  /** Acciones sin parámetros, numeradas desde 1. */
  readonly simple: readonly Simple[];
  /** Rango de envite o subida, si se puede envidar: se elige con `e N`. */
  readonly bet: {
    readonly type: 'envido' | 'reenvido';
    readonly min: number;
    readonly max: number;
  } | null;
  /** Se puede descartar: se elige con `d` y las posiciones de las cartas. */
  readonly discard: boolean;
}

export function buildMenu(legal: readonly Action[]): Menu {
  const simple: Simple[] = [];
  const amounts: number[] = [];
  let betType: 'envido' | 'reenvido' | null = null;
  let discard = false;
  for (const action of legal) {
    if (action.type === 'discard') discard = true;
    else if (action.type === 'envido' || action.type === 'reenvido') {
      betType = action.type;
      amounts.push(action.amount);
    } else simple.push(action);
  }
  const bet =
    betType === null
      ? null
      : { type: betType, min: Math.min(...amounts), max: Math.max(...amounts) };
  return { simple, bet, discard };
}

export function describeMenu(menu: Menu): string {
  const lines = menu.simple.map((action, i) => `  ${String(i + 1)}) ${formatAction(action)}`);
  if (menu.bet !== null) {
    const what = menu.bet.type === 'envido' ? 'envidar' : 'subir';
    lines.push(`  e N) ${what} N tantos (${String(menu.bet.min)}–${String(menu.bet.max)})`);
  }
  if (menu.discard) lines.push('  d 1 3) descartar las cartas en esas posiciones');
  return lines.join('\n');
}

export type Choice =
  { readonly ok: true; readonly action: Action } | { readonly ok: false; readonly error: string };

/** Traduce lo escrito a una acción de `legal`, o explica por qué no se puede. */
export function parseChoice(
  input: string,
  legal: readonly Action[],
  ownCards: readonly Card[] | null,
): Choice {
  const menu = buildMenu(legal);
  const [head = '', ...rest] = input.trim().toLowerCase().split(/\s+/);
  const pick = (action: Action): Choice =>
    legal.some((l) => sameAction(l, action))
      ? { ok: true, action }
      : { ok: false, error: 'Esa acción no está permitida ahora.' };

  if (/^\d+$/.test(head)) {
    const action = menu.simple[Number(head) - 1];
    return action === undefined
      ? { ok: false, error: 'No hay opción con ese número.' }
      : pick(action);
  }
  if (head === 'e' && menu.bet !== null) {
    const amount = Number(rest[0]);
    return pick({ type: menu.bet.type, amount });
  }
  if (head === 'd' && menu.discard && ownCards !== null) {
    const positions = rest.flatMap((part) => part.split('')).map(Number);
    const cards = positions.map((p) => ownCards[p - 1]);
    if (positions.length === 0 || cards.some((card) => card === undefined)) {
      return { ok: false, error: `Indica posiciones entre 1 y ${String(ownCards.length)}.` };
    }
    return pick({ type: 'discard', cards: cards.filter((card) => card !== undefined) });
  }
  return { ok: false, error: 'No entiendo. Escribe un número, «e N» o «d 1 3».' };
}
