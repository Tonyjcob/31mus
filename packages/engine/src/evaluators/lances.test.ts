import { describe, expect, it } from 'vitest';

import type { Card } from '../cards.js';
import type { PerSeat } from '../seat.js';
import { anyJuego, jugadaPoints, lancePlayers, lanceWinner } from './lances.js';

// J0 pareja de reyes y 31; J1 nada y 28; J2 medias de cincos y 25; J3 nada y 33.
const hands: PerSeat<readonly Card[]> = [
  ['oros-12', 'copas-12', 'oros-10', 'oros-1'],
  ['espadas-12', 'oros-11', 'copas-7', 'copas-1'],
  ['oros-5', 'copas-5', 'espadas-5', 'copas-10'],
  ['bastos-12', 'copas-11', 'oros-6', 'oros-7'],
];

describe('lancePlayers', () => {
  it('en grande, chica y punto juegan los cuatro', () => {
    expect(lancePlayers('grande', hands)).toEqual([0, 1, 2, 3]);
    expect(lancePlayers('chica', hands)).toEqual([0, 1, 2, 3]);
    expect(lancePlayers('punto', hands)).toEqual([0, 1, 2, 3]);
  });

  it('en pares y juego, solo quien tiene jugada', () => {
    expect(lancePlayers('pares', hands)).toEqual([0, 2]);
    expect(lancePlayers('juego', hands)).toEqual([0, 3]);
    expect(anyJuego(hands)).toBe(true);
  });
});

describe('jugadaPoints', () => {
  it('pares y juego suman las jugadas de la pareja', () => {
    expect(jugadaPoints('pares', hands, 0)).toBe(1 + 2);
    expect(jugadaPoints('pares', hands, 1)).toBe(0);
    expect(jugadaPoints('juego', hands, 0)).toBe(3);
    expect(jugadaPoints('juego', hands, 3)).toBe(2);
  });

  it('el punto vale 1; grande y chica no tienen valor de jugada', () => {
    expect(jugadaPoints('punto', hands, 2)).toBe(1);
    expect(jugadaPoints('grande', hands, 0)).toBe(0);
    expect(jugadaPoints('chica', hands, 0)).toBe(0);
  });
});

describe('lanceWinner', () => {
  it('resuelve cada lance con las mismas manos', () => {
    expect(lanceWinner('grande', hands, 0)).toBe(0);
    expect(lanceWinner('pares', hands, 1)).toBe(2);
    expect(lanceWinner('juego', hands, 1)).toBe(0);
  });
});
