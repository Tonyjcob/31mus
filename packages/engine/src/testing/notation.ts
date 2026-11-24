/**
 * Notación corta de cartas para tests y para la tabla de casos: número o figura + inicial del
 * palo. `R` rey, `C` caballo, `S` sota, `1`–`7`; `o` oros, `c` copas, `e` espadas, `b` bastos.
 * Ejemplo: `'Ro 3c Se 1b'`.
 */
import { isCard } from '../cards.js';
import type { Card } from '../cards.js';

const RANK_CODES: Readonly<Record<string, string>> = { R: '12', C: '11', S: '10' };
const SUIT_CODES: Readonly<Record<string, string>> = {
  o: 'oros',
  c: 'copas',
  e: 'espadas',
  b: 'bastos',
};

export function card(token: string): Card {
  const rank = token.slice(0, -1);
  const suit = SUIT_CODES[token.slice(-1)];
  const value = `${String(suit)}-${RANK_CODES[rank] ?? rank}`;
  if (!isCard(value)) throw new Error(`Carta no válida «${token}».`);
  return value;
}

export function cards(text: string): Card[] {
  return text.trim().split(/\s+/).map(card);
}
