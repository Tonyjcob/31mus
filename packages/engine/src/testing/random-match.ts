/**
 * Partidas completas con jugadores aleatorios (CLAUDE.md §9). El jugador elige primero un tipo de
 * acción con pesos parecidos a una partida real (mucho paso y quiero, pocos órdagos) y después una
 * variante, con preferencia por los envites pequeños. A veces juega la acción del temporizador.
 */
import { applyAction } from '../apply-action.js';
import type { Action } from '../actions.js';
import type { GameEvent } from '../events.js';
import { first } from '../invariant.js';
import { getLegalActions, pendingSeats } from '../legal-actions.js';
import { createMatch, startNextHand } from '../match.js';
import { createSeededRng } from '../rng.js';
import type { Rng } from '../rng.js';
import type { Seat } from '../seat.js';
import type { MatchState } from '../state.js';
import { getTimeoutAction } from '../timeout.js';

/** Probabilidad (por mil) de jugar la acción del temporizador en lugar de una aleatoria. */
const TIMEOUT_PER_MILLE = 100;
/** Probabilidad (por mil) de elegir el envite entre los más pequeños. */
const SMALL_BET_PER_MILLE = 900;
const SMALL_BETS = 4;
/** Tope de seguridad: una partida que no termina es un bug. */
export const MAX_ACTIONS_PER_MATCH = 20_000;

/** Peso relativo de cada tipo de acción. */
const TYPE_WEIGHTS: Readonly<Record<Action['type'], number>> = {
  mus: 40,
  corto: 10,
  discard: 10,
  paso: 60,
  envido: 25,
  reenvido: 10,
  quiero: 30,
  noQuiero: 30,
  ordago: 1,
};

export interface Transition {
  readonly before: MatchState;
  /** `null` cuando la transición es `startNextHand`. */
  readonly seat: Seat | null;
  readonly action: Action | null;
  readonly after: MatchState;
  readonly events: readonly GameEvent[];
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return first(items.slice(rng.nextInt(items.length)), 'nada que elegir');
}

function pickWeighted<T>(items: readonly T[], weight: (item: T) => number, rng: Rng): T {
  let ticket = rng.nextInt(items.reduce((acc, item) => acc + weight(item), 0));
  return first(
    items.filter((item) => {
      ticket -= weight(item);
      return ticket < 0;
    }),
    'nada que elegir',
  );
}

export function randomAction(state: MatchState, seat: Seat, rng: Rng): Action {
  const timeout = getTimeoutAction(state, seat);
  if (timeout !== null && rng.nextInt(1000) < TIMEOUT_PER_MILLE) return timeout;
  const legal = getLegalActions(state, seat);
  const type = pickWeighted([...new Set(legal.map((a) => a.type))], (t) => TYPE_WEIGHTS[t], rng);
  const options = legal.filter((a) => a.type === type);
  const isBet = type === 'envido' || type === 'reenvido';
  const small = isBet && rng.nextInt(1000) < SMALL_BET_PER_MILLE;
  return pick(small ? options.slice(0, SMALL_BETS) : options, rng);
}

export interface MatchRun {
  readonly final: MatchState;
  readonly actions: number;
  readonly hands: number;
}

export interface RandomMatchOptions {
  /** Recibe cada transición, para comprobar invariantes. */
  readonly observe?: (t: Transition) => void;
  /** Congela el estado antes de cada acción: si el motor lo mutara, fallaría. */
  readonly freeze?: boolean;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Juega una partida entera con jugadores aleatorios. */
export function playRandomMatch(seed: number, options: RandomMatchOptions = {}): MatchRun {
  const { observe, freeze = false } = options;
  const rng = createSeededRng(seed);
  let state = createMatch({}, rng);
  let actions = 0;
  while (state.matchWinner === null) {
    if (actions > MAX_ACTIONS_PER_MATCH) throw new Error(`La partida ${String(seed)} no termina.`);
    if (freeze) deepFreeze(state);
    if (state.hand.phase.kind === 'handOver') {
      const next = startNextHand(state, { rng });
      if (!next.ok) throw new Error(`startNextHand: ${next.error.code}`);
      observe?.({
        before: state,
        seat: null,
        action: null,
        events: next.value.events,
        after: next.value.state,
      });
      state = next.value.state;
      continue;
    }
    const seat = pick(pendingSeats(state), rng);
    const action = randomAction(state, seat, rng);
    const result = applyAction(state, seat, action, { rng });
    if (!result.ok) throw new Error(`Acción legal rechazada: ${result.error.code}`);
    observe?.({
      before: state,
      seat,
      action,
      events: result.value.events,
      after: result.value.state,
    });
    state = result.value.state;
    actions++;
  }
  return { final: state, actions, hands: state.hand.number };
}
