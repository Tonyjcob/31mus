/**
 * Cobro de tantos, cierre de juego y recuento (REGLAS_MUS.md §5.2–5.4 y §6).
 * En cuanto una pareja llega a 40 gana el juego al instante y no se cuenta nada más.
 */
import { jugadaPoints, lanceWinner } from '../evaluators/lances.js';
import { defined } from '../invariant.js';
import type { Lance } from '../evaluators/lances.js';
import type { PointsReason } from '../events.js';
import { GAMES_TO_WIN_MATCH, PASO_POINTS, POINTS_TO_WIN_GAME } from '../rules.js';
import { teamOf } from '../seat.js';
import type { Seat, Team } from '../seat.js';
import type { LanceRecord, MatchState, Score } from '../state.js';
import { emit, setPhase, updateState } from '../step.js';
import type { Step } from '../step.js';

export interface Scored {
  readonly step: Step;
  /** Si con estos tantos se cerró el juego. */
  readonly gameOver: boolean;
}

function withTeam(score: Score, team: Team, value: number): Score {
  return team === 0 ? [value, score[1]] : [score[0], value];
}

/** Suma tantos a una pareja y cierra el juego (y la partida) si llega a 40. */
export function addPoints(
  step: Step,
  team: Team,
  points: number,
  lance: Lance,
  reason: PointsReason,
): Scored {
  const { scores, gamesWon, gameNumber } = step.state;
  const score = Math.min(scores[team] + points, POINTS_TO_WIN_GAME);
  // El evento lleva los tantos que de verdad suben al marcador, ya topados en 40.
  let next = emit(updateState(step, { scores: withTeam(scores, team, score) }), {
    type: 'pointsScored',
    team,
    points: score - scores[team],
    lance,
    reason,
  });
  if (score < POINTS_TO_WIN_GAME) return { step: next, gameOver: false };

  const games = withTeam(gamesWon, team, gamesWon[team] + 1);
  next = emit(updateState(next, { gamesWon: games }), { type: 'gameWon', team, gameNumber });
  if (games[team] >= GAMES_TO_WIN_MATCH) {
    next = emit(updateState(next, { matchWinner: team }), { type: 'matchWon', team });
  }
  return { step: next, gameOver: true };
}

/** Termina la mano: los cuatro enseñan sus cartas (D16). */
export function endHand(step: Step, gameWinner: Team | null): Step {
  return emit(
    setPhase(step, { kind: 'handOver', gameWinner }),
    { type: 'handRevealed', hands: step.state.hand.hands },
    { type: 'handEnded' },
  );
}

/** Ganador de un lance que se juega (hay al menos un jugador con jugada). */
function winnerOf(state: MatchState, lance: Lance): Seat {
  // Un lance en paso, querido u ordagado siempre tiene jugadores.
  return defined(lanceWinner(lance, state.hand.hands, state.mano), `lance sin ganador (${lance})`);
}

/** Ganador de un lance que termina con un órdago aceptado (§5.4). */
export function ordagoWinner(state: MatchState, lance: Lance): Seat {
  return winnerOf(state, lance);
}

interface Award {
  readonly team: Team;
  readonly points: number;
}

/** Lo que se cobra de un lance en el recuento (§5.2–5.3, §6). */
function award(state: MatchState, { lance, outcome }: LanceRecord): Award | null {
  const { hands } = state.hand;
  const withJugadas = lance === 'pares' || lance === 'juego';
  switch (outcome.kind) {
    case 'noJugado':
      return null;
    case 'sinEnvite':
      return { team: outcome.team, points: jugadaPoints(lance, hands, outcome.team) };
    case 'rechazado':
      // En grande, chica y punto solo se cobra lo rechazado, que ya se cobró (D13).
      // En pares y juego, la pareja que apostó cobra además sus jugadas (D2).
      return withJugadas
        ? { team: outcome.team, points: jugadaPoints(lance, hands, outcome.team) }
        : null;
    case 'paso': {
      const winner = winnerOf(state, lance);
      const points =
        lance === 'grande' || lance === 'chica'
          ? PASO_POINTS
          : jugadaPoints(lance, hands, teamOf(winner));
      return { team: teamOf(winner), points };
    }
    case 'querido': {
      const winner = winnerOf(state, lance);
      return {
        team: teamOf(winner),
        points: outcome.amount + jugadaPoints(lance, hands, teamOf(winner)),
      };
    }
  }
}

/** Recuento en orden estricto: grande → chica → pares → juego o punto (§6). */
export function recount(step: Step): Step {
  let current = step;
  for (const record of step.state.hand.lances) {
    const won = award(current.state, record);
    if (won === null) continue;
    const scored = addPoints(current, won.team, won.points, record.lance, 'recuento');
    if (scored.gameOver) return endHand(scored.step, won.team);
    current = scored.step;
  }
  return endHand(current, null);
}
