import { describe, expect, it } from 'vitest';

import {
  SEATS,
  distanceFromMano,
  nextSeat,
  partnerOf,
  perSeat,
  seatsFrom,
  teamOf,
  teamSeats,
} from './seat.js';

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

  it('teamSeats devuelve los dos asientos de cada pareja', () => {
    expect(teamSeats(0)).toEqual([0, 2]);
    expect(teamSeats(1)).toEqual([1, 3]);
    for (const seat of SEATS) expect(teamSeats(teamOf(seat))).toContain(seat);
  });
});

describe('seatsFrom y distanceFromMano', () => {
  it('ordena desde la mano en sentido de juego', () => {
    expect(seatsFrom(0)).toEqual([0, 1, 2, 3]);
    expect(seatsFrom(3)).toEqual([3, 0, 1, 2]);
  });

  it('la mano está a distancia 0 y el postre a 3', () => {
    for (const mano of SEATS) {
      seatsFrom(mano).forEach((seat, i) => {
        expect(distanceFromMano(seat, mano)).toBe(i);
      });
    }
  });

  it('perSeat aplica la función a cada asiento', () => {
    expect(perSeat((seat) => seat * 10)).toEqual([0, 10, 20, 30]);
  });
});
