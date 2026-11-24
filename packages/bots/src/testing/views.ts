/**
 * Vistas de jugador para los tests de decisiones: lo que recibiría el bot en una situación
 * concreta. No forma parte del build.
 */
import { MAX_BET, MIN_ENVIDO, MIN_REENVIDO } from '@31mus/engine';
import type {
  Action,
  Bet,
  Declarations,
  Lance,
  PhaseView,
  PlayerView,
  Score,
  Seat,
} from '@31mus/engine';

import { cards } from './notation.js';

export interface ViewOptions {
  /** Mano propia en notación corta. */
  readonly hand: string;
  readonly phase: PhaseView;
  readonly seat?: Seat;
  readonly mano?: Seat;
  readonly scores?: Score;
  readonly declarations?: Declarations;
}

export function viewWith(options: ViewOptions): PlayerView {
  const seat = options.seat ?? 0;
  return {
    viewer: seat,
    mano: options.mano ?? 0,
    scores: options.scores ?? [0, 0],
    gamesWon: [0, 0],
    gameNumber: 1,
    handNumber: 1,
    matchWinner: null,
    phase: options.phase,
    pendingSeats: [seat],
    ownCards: cards(options.hand),
    ownDiscard: null,
    cardCounts: [4, 4, 4, 4],
    deckCount: 24,
    reshuffleWarning: false,
    lastDiscardCounts: null,
    declarations: options.declarations ?? { pares: null, juego: null },
    lances: [],
    revealedHands: null,
  };
}

const ALL: readonly Seat[] = [0, 1, 2, 3];

/** Fase de un lance en la que habla `turn`. */
export function lancePhase(
  lance: Lance,
  turn: Seat,
  options: { readonly speakers?: readonly Seat[]; readonly bet?: Bet | null } = {},
): PhaseView {
  return {
    kind: 'lance',
    lance,
    speakers: options.speakers ?? ALL,
    turn,
    bet: options.bet ?? null,
  };
}

/** Apuesta de la pareja `team` (por defecto, envido de 2 de la pareja 1 a la que responde 0). */
export function betOf(partial: Partial<Bet> = {}): Bet {
  return {
    team: 1,
    total: MIN_ENVIDO,
    onReject: 1,
    raised: false,
    ordago: false,
    responders: [0, 2],
    firstResponse: null,
    ...partial,
  };
}

function range(from: number, to: number): number[] {
  return to < from ? [] : Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Acciones legales al hablar sin apuesta. */
export function openingLegal(): Action[] {
  return [
    { type: 'paso' },
    ...range(MIN_ENVIDO, MAX_BET).map((amount): Action => ({ type: 'envido', amount })),
    { type: 'ordago' },
  ];
}

/** Acciones legales al responder a `bet`. */
export function answerLegal(bet: Bet): Action[] {
  const responses: Action[] = [{ type: 'quiero' }, { type: 'noQuiero' }];
  if (bet.ordago) return responses;
  return [
    ...responses,
    ...range(MIN_REENVIDO, MAX_BET - bet.total).map((amount): Action => ({
      type: 'reenvido',
      amount,
    })),
    { type: 'ordago' },
  ];
}
