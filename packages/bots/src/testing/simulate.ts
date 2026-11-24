/**
 * Arnés de simulación (ADR-0003 §6): juega partidas completas con un jugador por asiento y
 * cuenta lo que hace cada pareja. No forma parte del build.
 */
import {
  applyAction,
  createMatch,
  createSeededRng,
  getLegalActions,
  getView,
  pendingSeats,
  startNextHand,
  teamOf,
} from '@31mus/engine';
import type { Action, MatchState, PerSeat, PlayerView, Rng, Seat, Team } from '@31mus/engine';

import { randomAction } from '../random.js';
import type { BotDecision } from '../types.js';

/** Un jugador: decide con su vista y sus acciones legales. */
export type Player = (input: {
  readonly view: PlayerView;
  readonly legal: readonly Action[];
  readonly rng: Rng;
}) => BotDecision;

export const randomPlayer: Player = ({ legal, rng }) => ({
  action: randomAction(legal, rng),
  bluff: false,
});

/** Lo que hizo una pareja durante la partida. */
export interface TeamStats {
  decisions: number;
  /** Envites y subidas (sin órdagos). */
  bets: number;
  bluffs: number;
  ordagos: number;
  quieros: number;
  noQuieros: number;
  cuts: number;
  musCalls: number;
}

export interface MatchResult {
  readonly winner: Team;
  readonly hands: number;
  readonly stats: readonly [TeamStats, TeamStats];
}

/** Tope de seguridad: una partida que no termina es un bug. */
const MAX_DECISIONS = 50_000;

function emptyStats(): TeamStats {
  return {
    decisions: 0,
    bets: 0,
    bluffs: 0,
    ordagos: 0,
    quieros: 0,
    noQuieros: 0,
    cuts: 0,
    musCalls: 0,
  };
}

function record(stats: TeamStats, { action, bluff }: BotDecision): void {
  stats.decisions++;
  if (bluff) stats.bluffs++;
  switch (action.type) {
    case 'envido':
    case 'reenvido':
      stats.bets++;
      break;
    case 'ordago':
      stats.ordagos++;
      break;
    case 'quiero':
      stats.quieros++;
      break;
    case 'noQuiero':
      stats.noQuieros++;
      break;
    case 'corto':
      stats.cuts++;
      break;
    case 'mus':
      stats.musCalls++;
      break;
    default:
      break;
  }
}

export interface SimulateOptions {
  /** Recibe cada estado antes de cada decisión (para comprobar invariantes). */
  readonly observe?: (state: MatchState, seat: Seat, decision: BotDecision) => void;
}

/** Juega una partida entera con la semilla dada. */
export function simulateMatch(
  players: PerSeat<Player>,
  seed: number,
  options: SimulateOptions = {},
): MatchResult {
  const rng = createSeededRng(seed);
  const stats: [TeamStats, TeamStats] = [emptyStats(), emptyStats()];
  let state = createMatch({}, rng);
  for (let decisions = 0; state.matchWinner === null; decisions++) {
    if (decisions > MAX_DECISIONS) throw new Error(`La partida ${String(seed)} no termina.`);
    if (state.hand.phase.kind === 'handOver') {
      const next = startNextHand(state, { rng });
      if (!next.ok) throw new Error(`startNextHand: ${next.error.code}`);
      state = next.value.state;
      continue;
    }
    const [seat] = pendingSeats(state);
    if (seat === undefined) throw new Error('Nadie tiene la palabra.');
    const legal = getLegalActions(state, seat);
    const decision = players[seat]({ view: getView(state, seat), legal, rng });
    options.observe?.(state, seat, decision);
    record(stats[teamOf(seat)], decision);
    const result = applyAction(state, seat, decision.action, { rng });
    if (!result.ok)
      throw new Error(`Acción rechazada (${result.error.code}) en la partida ${String(seed)}.`);
    state = result.value.state;
  }
  return { winner: state.matchWinner, hands: state.hand.number, stats };
}

/** Los mismos jugadores por pareja: `team0` en los asientos 0 y 2, `team1` en 1 y 3. */
export function pairs(team0: Player, team1: Player): PerSeat<Player> {
  return [team0, team1, team0, team1];
}
