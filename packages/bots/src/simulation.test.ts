/**
 * Muestra de simulación que corre en cada commit (ADR-0003 §6). La simulación completa de la DoD
 * está en `dod.sim.test.ts` (`pnpm --filter @31mus/bots sim`).
 */
import {
  createSeededRng,
  getLegalActions,
  getView,
  partnerOf,
  nextSeat,
  sameAction,
} from '@31mus/engine';
import type { MatchState, Seat } from '@31mus/engine';
import { describe, expect, it } from 'vitest';

import { decideAction } from './decide.js';
import { BOT_PERSONAS } from './personas.js';
import { pairs, randomPlayer, simulateMatch } from './testing/simulate.js';
import type { Player } from './testing/simulate.js';
import type { BotDecision, BotPersona } from './types.js';

const SAMPLE_MATCHES = 1_000;
const VERSUS_RANDOM_MATCHES = 2_000;
const MIN_WIN_RATE_VS_RANDOM = 0.7;
/** Cada cuántas decisiones se comprueban las propiedades caras. */
const CHECK_EVERY = 50;
const SIMULATION_TIMEOUT_MS = 60_000;

const bot =
  (persona: BotPersona): Player =>
  (input) =>
    decideAction({ ...input, persona });

function personaAt(index: number): BotPersona {
  const persona = BOT_PERSONAS[index % BOT_PERSONAS.length];
  if (persona === undefined) throw new RangeError('Catálogo vacío.');
  return persona;
}

/** El mismo estado con las manos de los dos rivales de `seat` intercambiadas. */
function swapRivalHands(state: MatchState, seat: Seat): MatchState {
  const left = nextSeat(seat);
  const right = nextSeat(partnerOf(seat));
  const hands = [...state.hand.hands] as [...typeof state.hand.hands];
  [hands[left], hands[right]] = [hands[right], hands[left]];
  return { ...state, hand: { ...state.hand, hands } };
}

describe('partidas entre bots (muestra)', () => {
  it(
    `${String(SAMPLE_MATCHES)} partidas con personajes variados terminan sin errores`,
    () => {
      let decisions = 0;
      let illegal = 0;
      const observe = (state: MatchState, seat: Seat, { action }: BotDecision) => {
        decisions++;
        if (!getLegalActions(state, seat).some((a) => sameAction(a, action))) illegal++;
        if (decisions % CHECK_EVERY !== 0) return;
        const persona = personaAt(decisions);
        const view = getView(state, seat);
        const legal = getLegalActions(state, seat);
        const again = (v = view) =>
          decideAction({ view: v, legal, persona, rng: createSeededRng(decisions) });
        // Determinista: misma entrada y misma semilla, misma decisión.
        expect(again()).toEqual(again());
        // No ve las cartas ajenas: si cambian, su vista y su decisión no cambian.
        const other = getView(swapRivalHands(state, seat), seat);
        expect(other).toEqual(view);
        expect(again(other)).toEqual(again());
      };
      for (let seed = 0; seed < SAMPLE_MATCHES; seed++) {
        const players = [0, 1, 2, 3].map((i) => bot(personaAt(seed + i))) as [
          Player,
          Player,
          Player,
          Player,
        ];
        simulateMatch(players, seed, { observe });
      }
      expect(illegal).toBe(0);
      expect(decisions).toBeGreaterThan(SAMPLE_MATCHES);
    },
    SIMULATION_TIMEOUT_MS,
  );

  it(
    `el bot medio gana al aleatorio al menos el ${String(MIN_WIN_RATE_VS_RANDOM * 100)} %`,
    () => {
      let wins = 0;
      for (let seed = 0; seed < VERSUS_RANDOM_MATCHES; seed++) {
        // La mitad de las partidas, el bot en la otra pareja.
        const botTeam = seed % 2 === 0 ? 0 : 1;
        const medium = bot(personaAt(seed));
        const players = botTeam === 0 ? pairs(medium, randomPlayer) : pairs(randomPlayer, medium);
        if (simulateMatch(players, seed).winner === botTeam) wins++;
      }
      expect(wins / VERSUS_RANDOM_MATCHES).toBeGreaterThanOrEqual(MIN_WIN_RATE_VS_RANDOM);
    },
    SIMULATION_TIMEOUT_MS,
  );
});
