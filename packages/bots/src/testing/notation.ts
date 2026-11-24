/**
 * Notación corta de cartas para los tests, la misma que en el motor: número o figura + inicial del
 * palo (`R` rey, `C` caballo, `S` sota; `o` oros, `c` copas, `e` espadas, `b` bastos).
 * Ejemplo: `'Ro 3c Se 1b'`.
 */
import { isCard } from '@31mus/engine';
import type { Card } from '@31mus/engine';

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
