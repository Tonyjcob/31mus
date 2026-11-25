import { type Action, type Card } from '@31mus/engine';
import { describe, expect, it } from 'vitest';

import { formatAction, formatCard, seatLabel } from './format.js';
import { buildMenu, describeMenu, parseChoice } from './menu.js';

const BETTING: Action[] = [
  { type: 'paso' },
  ...[2, 3, 4, 40].map((amount) => ({ type: 'envido' as const, amount })),
  { type: 'ordago' },
];
const HAND: Card[] = ['oros-1', 'copas-12', 'espadas-3', 'bastos-7'];
const DISCARDS: Action[] = [
  { type: 'discard', cards: ['oros-1'] },
  { type: 'discard', cards: ['oros-1', 'espadas-3'] },
];

describe('menú del cliente de consola', () => {
  it('agrupa los envites en un rango y numera el resto', () => {
    const menu = buildMenu(BETTING);
    expect(menu.simple).toEqual([{ type: 'paso' }, { type: 'ordago' }]);
    expect(menu.bet).toEqual({ type: 'envido', min: 2, max: 40 });
    expect(describeMenu(menu)).toContain('e N) envidar N tantos (2–40)');
  });

  it('traduce números, envites y descartes a acciones legales', () => {
    expect(parseChoice('2', BETTING, HAND)).toEqual({ ok: true, action: { type: 'ordago' } });
    expect(parseChoice('e 4', BETTING, HAND)).toEqual({
      ok: true,
      action: { type: 'envido', amount: 4 },
    });
    expect(parseChoice('d 3 1', DISCARDS, HAND)).toEqual({
      ok: true,
      action: { type: 'discard', cards: ['espadas-3', 'oros-1'] },
    });
    expect(parseChoice('d 13', DISCARDS, HAND).ok).toBe(true);
  });

  it('rechaza lo que no es legal o no se entiende', () => {
    expect(parseChoice('9', BETTING, HAND).ok).toBe(false);
    expect(parseChoice('e 5', BETTING, HAND).ok).toBe(false);
    expect(parseChoice('d 2', DISCARDS, HAND).ok).toBe(false);
    expect(parseChoice('d 7', DISCARDS, HAND).ok).toBe(false);
    expect(parseChoice('hola', BETTING, HAND).ok).toBe(false);
  });

  it('da nombres legibles a cartas, acciones y asientos', () => {
    expect(formatCard('espadas-3')).toBe('Tres (rey) de espadas');
    expect(formatAction({ type: 'reenvido', amount: 5 })).toBe('5 más');
    expect(seatLabel(1, 0, ['ana', 'Abuelo', 'Faraona', 'Pollo'])).toBe('Abuelo (rival der.)');
    expect(seatLabel(0, 0, ['ana'])).toBe('tú');
  });
});
