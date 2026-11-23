import { describe, expect, it } from 'vitest';

import { SEATS, nextSeat, partnerOf } from './seat.js';

describe('nextSeat', () => {
  it('avanza en orden antihorario: (seat + 1) % 4', () => {
    for (const seat of SEATS) {
      expect(nextSeat(seat)).toBe((seat + 1) % 4);
    }
  });

  it('vuelve al asiento inicial tras cuatro turnos', () => {
    for (const seat of SEATS) {
      expect(nextSeat(nextSeat(nextSeat(nextSeat(seat))))).toBe(seat);
    }
  });
});

describe('partnerOf', () => {
  it('empareja 0 con 2 y 1 con 3', () => {
    expect(partnerOf(0)).toBe(2);
    expect(partnerOf(2)).toBe(0);
    expect(partnerOf(1)).toBe(3);
    expect(partnerOf(3)).toBe(1);
  });
});
