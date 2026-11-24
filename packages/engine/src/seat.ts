/**
 * Asientos de la mesa. Parejas: 0 y 2 contra 1 y 3 (CLAUDE.md §6).
 */
export const SEATS = [0, 1, 2, 3] as const;

export type Seat = (typeof SEATS)[number];

const NEXT_SEAT: Readonly<Record<Seat, Seat>> = { 0: 1, 1: 2, 2: 3, 3: 0 };
const PARTNER_SEAT: Readonly<Record<Seat, Seat>> = { 0: 2, 1: 3, 2: 0, 3: 1 };

/**
 * Siguiente asiento en orden de juego: antihorario, "a la derecha"
 * (`siguiente = (seat + 1) % 4`, REGLAS_MUS.md §2).
 */
export function nextSeat(seat: Seat): Seat {
  return NEXT_SEAT[seat];
}

/** Compañero de pareja del asiento dado. */
export function partnerOf(seat: Seat): Seat {
  return PARTNER_SEAT[seat];
}

/** Un valor por asiento, indexado por `Seat`. */
export type PerSeat<T> = readonly [T, T, T, T];

/** Crea un `PerSeat` aplicando `fn` a cada asiento. */
export function perSeat<T>(fn: (seat: Seat) => T): PerSeat<T> {
  return [fn(0), fn(1), fn(2), fn(3)];
}

/** Los cuatro asientos en orden de juego empezando por `mano` (mano → 2.º → 3.º → postre). */
export function seatsFrom(mano: Seat): PerSeat<Seat> {
  const second = nextSeat(mano);
  const third = nextSeat(second);
  return [mano, second, third, nextSeat(third)];
}

/** Distancia a la mano en orden de juego: 0 para la mano, 3 para el postre (desempates, §2). */
export function distanceFromMano(seat: Seat, mano: Seat): number {
  return (seat - mano + SEATS.length) % SEATS.length;
}
