// API pública del motor de reglas (CLAUDE.md §6, ADR-0002).
export * from './rules.js';
export { SEATS, distanceFromMano, nextSeat, partnerOf, perSeat, seatsFrom } from './seat.js';
export type { PerSeat, Seat } from './seat.js';
export {
  FULL_DECK,
  MUS_RANKS,
  RANKS,
  SUITS,
  cardPoints,
  cardRank,
  cardSuit,
  isCard,
  musRank,
} from './cards.js';
export type { Card, MusRank, Rank, Suit } from './cards.js';
export { createSeededRng, shuffle } from './rng.js';
export type { Rng } from './rng.js';
export { err, ok } from './result.js';
export type { Result } from './result.js';
export { MUS_ERROR_CODES, musError } from './errors.js';
export type { MusError, MusErrorCode } from './errors.js';
export { LANCES, anyJuego, jugadaPoints, lancePlayers, lanceWinner } from './evaluators/lances.js';
export type { Lance } from './evaluators/lances.js';
export { chicaKey, compareChica, compareGrande, grandeKey } from './evaluators/grande-chica.js';
export type { ChicaKey, GrandeKey } from './evaluators/grande-chica.js';
export { comparePares, paresKey, paresPoints } from './evaluators/pares.js';
export type { ParesKey, ParesKind } from './evaluators/pares.js';
export {
  JUEGO_ORDER,
  compareJuego,
  comparePunto,
  handPoints,
  juegoKey,
  juegoPoints,
} from './evaluators/juego-punto.js';
