// API pública del motor de reglas (CLAUDE.md §6, ADR-0002).
export * from './rules.js';
export {
  SEATS,
  TEAMS,
  distanceFromMano,
  nextSeat,
  partnerOf,
  perSeat,
  seatsFrom,
  teamOf,
} from './seat.js';
export type { PerSeat, Seat, Team } from './seat.js';
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
export { sameAction } from './actions.js';
export type { Action, BetAction } from './actions.js';
export type { GameEvent, PointsReason, Viewer } from './events.js';
export { getEventView } from './events.js';
export type {
  Bet,
  BetResponse,
  Declarations,
  HandState,
  LanceOutcome,
  LanceRecord,
  MatchConfig,
  MatchState,
  Phase,
  Score,
} from './state.js';
export type { CardPile } from './deck.js';
export { createMatch, startNextHand } from './match.js';
export { applyAction } from './apply-action.js';
export { getLegalActions, pendingSeats } from './legal-actions.js';
export { TIMEOUT_DISCARD_ORDER, getTimeoutAction, timeoutDiscard } from './timeout.js';
export { getView } from './view.js';
export type { PhaseView, PlayerView } from './view.js';
export type { Step } from './step.js';
