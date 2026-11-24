/**
 * Ciclo de la partida (REGLAS_MUS.md §2 y §6): sorteo de la primera mano, rotación de la mano,
 * fin de juego (tantos a 0) y partida al mejor de 3. Entre manos, el servidor decide cuánto se
 * muestran las cartas y luego llama a `startNextHand` (ADR-0002 §3).
 */
import { musError } from './errors.js';
import type { MusError } from './errors.js';
import { dealHand } from './phases/deal.js';
import { err, ok } from './result.js';
import type { Result } from './result.js';
import type { Rng } from './rng.js';
import { SEATS, nextSeat } from './seat.js';
import type { Seat } from './seat.js';
import type { MatchConfig, MatchState } from './state.js';
import type { Step } from './step.js';

/** El asiento a `steps` posiciones del 0 en orden de juego. */
function seatAfter(steps: number): Seat {
  let seat: Seat = 0;
  for (let i = 0; i < steps; i++) seat = nextSeat(seat);
  return seat;
}

/** Crea la partida y reparte la primera mano. La primera mano se sortea si no se indica. */
export function createMatch(config: MatchConfig, rng: Rng): MatchState {
  const mano = config.firstMano ?? seatAfter(rng.nextInt(SEATS.length));
  const base = {
    mano,
    scores: [0, 0],
    gamesWon: [0, 0],
    gameNumber: 1,
    matchWinner: null,
  } as const;
  return dealHand(base, 1, rng).state;
}

/**
 * Reparte la mano siguiente cuando la actual está terminada. La mano pasa al siguiente jugador,
 * también entre juegos; si en la mano se cerró un juego, los tantos vuelven a 0.
 */
export function startNextHand(state: MatchState, ctx: { rng: Rng }): Result<Step, MusError> {
  if (state.matchWinner !== null) {
    return err(musError('MATCH_OVER', 'La partida ha terminado.'));
  }
  const { phase } = state.hand;
  if (phase.kind !== 'handOver') {
    return err(musError('HAND_NOT_OVER', 'La mano actual no ha terminado.'));
  }
  const gameOver = phase.gameWinner !== null;
  const base = {
    mano: nextSeat(state.mano),
    scores: gameOver ? ([0, 0] as const) : state.scores,
    gamesWon: state.gamesWon,
    gameNumber: gameOver ? state.gameNumber + 1 : state.gameNumber,
    matchWinner: null,
  };
  return ok(dealHand(base, state.hand.number + 1, ctx.rng));
}
