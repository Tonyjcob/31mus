/**
 * Envites del bot medio (ADR-0003 §3): hablar sin apuesta (paso, envido u órdago) y responder a
 * una apuesta (quiero, no quiero, subir u órdago), con el estilo del personaje y el marcador.
 */
import { MIN_ENVIDO, POINTS_TO_WIN_GAME, teamOf } from '@31mus/engine';
import type { Action, Bet, PlayerView, Rng, Seat } from '@31mus/engine';

import { closestAmount, findAction, requireAction, requireAmount } from './choose.js';
import {
  AMOUNT_SCALE,
  BET_STYLE_SPREAD,
  BET_THRESHOLD,
  BLUFF_PER_MILLE,
  CALL_MARGIN,
  CAUTION_SPREAD,
  NEUTRAL_TRAIT,
  ORDAGO_CALL_THRESHOLD,
  ORDAGO_PER_MILLE,
  ORDAGO_PRESSURE_SHIFT,
  ORDAGO_STYLE_SPREAD,
  ORDAGO_THRESHOLD,
  PER_MILLE,
  PRESSURE_SHIFT,
  RAISE_AMOUNT,
  RAISE_BLUFF_FACTOR,
  RAISE_THRESHOLD,
} from './tuning.js';
import type { BotDecision, BotStyle } from './types.js';

/** Desplazamiento de un rasgo respecto al Bot neutro. */
const shift = (trait: number) => trait - NEUTRAL_TRAIT;

export interface BetContext {
  readonly view: PlayerView;
  readonly seat: Seat;
  readonly legal: readonly Action[];
  readonly style: BotStyle;
  readonly rng: Rng;
  /** Probabilidad de que la pareja gane el lance. */
  readonly chance: number;
  /** Presión del marcador, de 0 a 1. */
  readonly pressure: number;
}

const decided = (action: Action, bluff = false): BotDecision => ({ action, bluff });

function ordagoThreshold({ style, pressure }: BetContext): number {
  return (
    ORDAGO_THRESHOLD -
    shift(style.ordagoPropensity) * ORDAGO_STYLE_SPREAD -
    pressure * ORDAGO_PRESSURE_SHIFT
  );
}

/**
 * Órdago: con la mano casi ganada y, aun así, solo a veces (según la propensión del personaje):
 * con la mano segura suele rentar más un envite que los rivales quieran.
 */
function goesOrdago(ctx: BetContext): boolean {
  if (ctx.chance < ordagoThreshold(ctx)) return false;
  return ctx.rng.nextInt(PER_MILLE) < ctx.style.ordagoPropensity * ORDAGO_PER_MILLE;
}

function bluffs({ style, rng }: BetContext, factor: number): boolean {
  return rng.nextInt(PER_MILLE) < style.bluffRate * BLUFF_PER_MILLE * factor;
}

/** Hablar sin apuesta en el lance. */
export function openBet(ctx: BetContext): BotDecision {
  const { legal, style, chance, pressure } = ctx;
  const paso = requireAction(legal, 'paso');
  const ordago = findAction(legal, 'ordago');
  if (ordago !== null && goesOrdago(ctx)) return decided(ordago);
  const threshold =
    BET_THRESHOLD - shift(style.aggression) * BET_STYLE_SPREAD - pressure * PRESSURE_SHIFT;
  if (chance >= threshold) {
    const amount = MIN_ENVIDO + Math.round((chance - threshold) * AMOUNT_SCALE);
    return decided(requireAmount(legal, 'envido', amount));
  }
  if (bluffs(ctx, 1)) return decided(requireAmount(legal, 'envido', MIN_ENVIDO), true);
  return decided(paso);
}

/** ¿Les da el juego a los rivales lo que cobran si no quiero? */
function rejectLosesGame(view: PlayerView, seat: Seat, bet: Bet): boolean {
  const rivals = teamOf(seat) === 0 ? 1 : 0;
  return view.scores[rivals] + bet.onReject >= POINTS_TO_WIN_GAME;
}

/** Responder a una apuesta de los rivales. */
export function answerBet(ctx: BetContext, bet: Bet): BotDecision {
  const { view, seat, legal, style, chance, pressure } = ctx;
  const quiero = requireAction(legal, 'quiero');
  const noQuiero = requireAction(legal, 'noQuiero');
  const mustCall = rejectLosesGame(view, seat, bet);
  const caution = shift(style.caution) * CAUTION_SPREAD;

  if (bet.ordago) {
    const callAt =
      ORDAGO_CALL_THRESHOLD + caution - shift(style.ordagoPropensity) * ORDAGO_STYLE_SPREAD;
    return decided(mustCall || chance >= callAt ? quiero : noQuiero);
  }

  const ordago = findAction(legal, 'ordago');
  if (ordago !== null && goesOrdago(ctx)) return decided(ordago);
  const raiseAt =
    RAISE_THRESHOLD - shift(style.aggression) * BET_STYLE_SPREAD - pressure * PRESSURE_SHIFT;
  const raise = closestAmount(legal, 'reenvido', RAISE_AMOUNT);
  if (raise !== null && chance >= raiseAt) return decided(raise);
  // Querer compensa si la probabilidad supera el punto de equilibrio: (1 − rechazado/total) / 2.
  const breakEven = (1 - bet.onReject / bet.total) / 2;
  if (mustCall || chance >= breakEven + CALL_MARGIN + caution) return decided(quiero);
  if (raise !== null && bluffs(ctx, RAISE_BLUFF_FACTOR)) return decided(raise, true);
  return decided(noQuiero);
}
