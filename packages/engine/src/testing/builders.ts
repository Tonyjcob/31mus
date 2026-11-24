/**
 * Construcción de estados y partidas para los tests (ADR-0002 §10). No forma parte del build.
 */
import { applyAction } from '../apply-action.js';
import type { Action } from '../actions.js';
import { FULL_DECK } from '../cards.js';
import type { Card } from '../cards.js';
import { createSeededRng } from '../rng.js';
import type { Rng } from '../rng.js';
import { seatsFrom } from '../seat.js';
import type { PerSeat, Seat } from '../seat.js';
import type { MatchState, Phase, Score } from '../state.js';
import type { Step } from '../step.js';
import { cards } from './notation.js';

export interface StateOptions {
  /** Manos en notación corta, por asiento. */
  readonly hands: readonly [string, string, string, string];
  readonly mano?: Seat;
  readonly scores?: Score;
  readonly gamesWon?: Score;
  /** Mazo por repartir (por defecto, el resto de la baraja en orden fijo). */
  readonly deck?: readonly Card[];
  readonly discards?: readonly Card[];
  readonly phase?: Phase;
}

/** Estado con manos concretas, en la fase de mus por la mano (o la fase indicada). */
export function stateWith(options: StateOptions): MatchState {
  const hands = options.hands.map(cards) as unknown as PerSeat<readonly Card[]>;
  const inHands = new Set(hands.flat());
  const mano = options.mano ?? 0;
  return {
    mano,
    scores: options.scores ?? [0, 0],
    gamesWon: options.gamesWon ?? [0, 0],
    gameNumber: 1,
    matchWinner: null,
    hand: {
      number: 1,
      hands,
      pile: {
        deck: options.deck ?? FULL_DECK.filter((c) => !inHands.has(c)),
        discards: options.discards ?? [],
      },
      phase: options.phase ?? { kind: 'mus', turn: mano },
      lances: [],
      declarations: { pares: null, juego: null },
      lastDiscardCounts: null,
    },
  };
}

export type Move = readonly [Seat, Action];

/** Aplica jugadas en orden; falla el test si alguna no es legal. */
export function play(
  state: MatchState,
  moves: readonly Move[],
  rng: Rng = createSeededRng(0),
): Step {
  let current: Step = { state, events: [] };
  for (const [seat, action] of moves) {
    const result = applyAction(current.state, seat, action, { rng });
    if (!result.ok) {
      throw new Error(`Jugada rechazada (${String(seat)} ${action.type}): ${result.error.code}`);
    }
    current = { state: result.value.state, events: [...current.events, ...result.value.events] };
  }
  return current;
}

/** Atajos de acciones. */
export const act = {
  mus: { type: 'mus' },
  corto: { type: 'corto' },
  paso: { type: 'paso' },
  quiero: { type: 'quiero' },
  noQuiero: { type: 'noQuiero' },
  ordago: { type: 'ordago' },
  envido: (amount: number): Action => ({ type: 'envido', amount }),
  reenvido: (amount: number): Action => ({ type: 'reenvido', amount }),
  discard: (text: string): Action => ({ type: 'discard', cards: cards(text) }),
} as const satisfies Record<string, Action | ((arg: never) => Action)>;

/** Los cuatro hacen lo mismo por orden desde `from` (p. ej. cuatro "mus" o cuatro "paso"). */
export function everyone(action: Action, from: Seat = 0): Move[] {
  return seatsFrom(from).map((seat) => [seat, action] as const);
}

/** Los cuatro pasan en un lance de cuatro, empezando por `from`. */
export function allPass(from: Seat): Move[] {
  return everyone(act.paso, from);
}
