/**
 * Propiedades del motor sobre partidas completas aleatorias (CLAUDE.md §9, DoD de H1).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { sameAction } from './actions.js';
import { FULL_DECK } from './cards.js';
import type { Card } from './cards.js';
import { getEventView } from './events.js';
import type { Viewer } from './events.js';
import { getLegalActions, pendingSeats } from './legal-actions.js';
import { POINTS_TO_WIN_GAME } from './rules.js';
import { SEATS, TEAMS } from './seat.js';
import type { MatchState } from './state.js';
import { playRandomMatch } from './testing/random-match.js';
import type { Transition } from './testing/random-match.js';
import { getTimeoutAction } from './timeout.js';
import { getView } from './view.js';

const SIMULATED_MATCHES = 1000;
const CHECKED_MATCHES = 40;
const SLOW_TEST_MS = 300_000;

/** Cartas que aparecen en un texto JSON. */
function cardsIn(json: string): Card[] {
  return FULL_DECK.filter((card) => json.includes(`"${card}"`));
}

function expectOnly(json: string, allowed: ReadonlySet<Card>, context: string): void {
  const leaked = cardsIn(json).filter((card) => !allowed.has(card));
  expect(leaked, context).toEqual([]);
}

function checkCards(state: MatchState): void {
  const { hands, pile } = state.hand;
  const all = [...hands.flat(), ...pile.deck, ...pile.discards];
  expect(all).toHaveLength(40);
  expect(new Set(all).size).toBe(40);
}

function checkScores({ before, after }: Transition): void {
  for (const team of TEAMS) {
    expect(after.scores[team]).toBeGreaterThanOrEqual(0);
    expect(after.scores[team]).toBeLessThanOrEqual(POINTS_TO_WIN_GAME);
    // Los tantos nunca disminuyen dentro de un juego.
    if (before.gameNumber === after.gameNumber) {
      expect(after.scores[team]).toBeGreaterThanOrEqual(before.scores[team]);
    }
  }
  // Ninguna pareja llega a 40 sin cerrar el juego.
  if (after.scores.includes(POINTS_TO_WIN_GAME)) {
    expect(after.hand.phase).toMatchObject({ kind: 'handOver' });
    expect(after.hand.phase.kind === 'handOver' && after.hand.phase.gameWinner).not.toBeNull();
  }
}

function checkTurns(state: MatchState): void {
  const pending = pendingSeats(state);
  expect(pending.length === 0).toBe(state.hand.phase.kind === 'handOver');
  for (const seat of SEATS) {
    const legal = getLegalActions(state, seat);
    const timeout = getTimeoutAction(state, seat);
    if (pending.includes(seat)) {
      expect(legal.length).toBeGreaterThan(0);
      // La acción del temporizador siempre es legal.
      expect(timeout !== null && legal.some((a) => sameAction(a, timeout))).toBe(true);
    } else {
      expect(legal).toEqual([]);
      expect(timeout).toBeNull();
    }
  }
}

function checkInformation({ before, after, events }: Transition): void {
  const revealed = after.hand.phase.kind === 'handOver';
  const viewers: Viewer[] = [...SEATS, 'spectator'];
  for (const viewer of viewers) {
    const own = new Set<Card>(
      viewer === 'spectator' ? [] : [...before.hand.hands[viewer], ...after.hand.hands[viewer]],
    );
    const viewAllowed = revealed ? new Set(FULL_DECK) : own;
    expectOnly(JSON.stringify(getView(after, viewer)), viewAllowed, `vista de ${String(viewer)}`);
    for (const event of events) {
      const filtered = getEventView(event, viewer);
      const allowed = event.type === 'handRevealed' ? new Set(FULL_DECK) : own;
      expectOnly(JSON.stringify(filtered), allowed, `evento ${event.type} para ${String(viewer)}`);
    }
  }
}

function checkTransition(t: Transition): void {
  checkCards(t.after);
  checkScores(t);
  checkTurns(t.after);
  checkInformation(t);
  // El estado es JSON puro: ida y vuelta sin pérdidas.
  expect(JSON.parse(JSON.stringify(t.after))).toEqual(t.after);
}

describe('propiedades en partidas aleatorias', () => {
  it(
    'cada transición cumple los invariantes y no muta el estado de entrada',
    () => {
      fc.assert(
        fc.property(fc.integer(), (seed) => {
          const run = playRandomMatch(seed, { observe: checkTransition, freeze: true });
          expect(run.final.matchWinner).not.toBeNull();
        }),
        { numRuns: CHECKED_MATCHES },
      );
    },
    SLOW_TEST_MS,
  );
});

describe(`${String(SIMULATED_MATCHES)} partidas completas`, () => {
  it(
    'terminan todas sin errores, con un ganador de 2 juegos, y pasan por todas las reglas',
    () => {
      const seen = new Set<string>();
      const observe = ({ events }: Transition) => {
        for (const event of events) {
          seen.add(event.type);
          if (event.type === 'pointsScored') seen.add(`${event.reason}:${event.lance}`);
          if (event.type === 'lanceClosed') seen.add(`${event.outcome.kind}:${event.lance}`);
        }
      };
      let hands = 0;
      for (let seed = 0; seed < SIMULATED_MATCHES; seed++) {
        const { final, hands: played } = playRandomMatch(seed, { observe });
        const winner = final.matchWinner;
        expect(winner).not.toBeNull();
        if (winner !== null) expect(final.gamesWon[winner]).toBe(2);
        hands += played;
      }
      expect(hands).toBeGreaterThan(SIMULATED_MATCHES);
      // Si el jugador aleatorio deja de pasar por alguna regla, el test lo dice.
      for (const path of [
        'discardsReshuffled',
        'ordagoResolved',
        'matchWon',
        'negada:grande',
        'deje:chica',
        'recuento:pares',
        'recuento:punto',
        'querido:juego',
        'rechazado:pares',
        'sinEnvite:juego',
        'noJugado:pares',
        'paso:punto',
      ]) {
        expect(seen, path).toContain(path);
      }
    },
    SLOW_TEST_MS,
  );
});
