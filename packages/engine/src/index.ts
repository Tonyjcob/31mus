// API pública del motor de reglas (CLAUDE.md §6, ADR-0002).
export * from './rules.js';
export { SEATS, nextSeat, partnerOf } from './seat.js';
export type { Seat } from './seat.js';
export { createSeededRng, shuffle } from './rng.js';
export type { Rng } from './rng.js';
export { err, ok } from './result.js';
export type { Result } from './result.js';
export { MUS_ERROR_CODES, musError } from './errors.js';
export type { MusError, MusErrorCode } from './errors.js';
