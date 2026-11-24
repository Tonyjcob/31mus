/**
 * Lectura de un lance desde la vista del bot (ADR-0003 §2): con qué probabilidad gana su pareja,
 * teniendo en cuenta quién juega, lo que ha hecho el compañero y si un rival ha envidado.
 */
import { POINTS_TO_WIN_GAME, partnerOf, teamOf } from '@31mus/engine';
import type { Bet, Card, Lance, PlayerView, Seat } from '@31mus/engine';

import { ANY_HAND, edge, tieShare, winProbability } from './odds.js';
import type { Range } from './odds.js';
import { lanceStats } from './strength.js';
import {
  PARTNER_CALLED,
  PARTNER_FOLDED,
  PARTNER_PASSED,
  PRESSURE_FROM,
  RIVAL_BET,
} from './tuning.js';

export interface LanceView {
  readonly lance: Lance;
  readonly speakers: readonly Seat[];
  readonly bet: Bet | null;
}

/** En pares y juego solo juegan quienes tienen jugada; en el resto, los cuatro. */
function plays(view: LanceView, seat: Seat): boolean {
  return view.speakers.includes(seat);
}

function partnerRange(view: LanceView, seat: Seat): Range | null {
  const partner = partnerOf(seat);
  if (!plays(view, partner)) return null;
  const { bet } = view;
  if (bet !== null) {
    // El compañero ya respondió a esta apuesta antes que yo.
    if (bet.responders[0] === partner && bet.firstResponse !== null) {
      return bet.firstResponse === 'quiero' ? PARTNER_CALLED : PARTNER_FOLDED;
    }
    return ANY_HAND;
  }
  // Sin apuesta, si el compañero habló antes que yo, pasó.
  return view.speakers.indexOf(partner) < view.speakers.indexOf(seat) ? PARTNER_PASSED : ANY_HAND;
}

function rivalRanges(view: LanceView, seat: Seat): Range[] {
  const rivals = view.speakers.filter((s) => teamOf(s) !== teamOf(seat));
  // Si los rivales apostaron, se supone buena mano a uno de ellos (no sé cuál).
  return rivals.map((_, index) => (view.bet !== null && index === 0 ? RIVAL_BET : ANY_HAND));
}

/** Probabilidad de que la pareja de `seat` gane el lance en curso. */
export function lanceWinChance(view: LanceView, hand: readonly Card[], seat: Seat, mano: Seat) {
  const stats = lanceStats(view.lance, hand);
  // Solo habla quien juega el lance: quien no tiene pares no habla en pares.
  if (stats === null) throw new RangeError(`La mano no juega el lance de ${view.lance}.`);
  const u = edge(stats, tieShare(seat, mano));
  return winProbability(u, partnerRange(view, seat), rivalRanges(view, seat));
}

/** De 0 a 1: cuánto aprieta el marcador (alguna pareja cerca de 40). */
export function pressure(view: PlayerView): number {
  const top = Math.max(...view.scores);
  const span = POINTS_TO_WIN_GAME - PRESSURE_FROM;
  return Math.min(1, Math.max(0, (top - PRESSURE_FROM) / span));
}
