/**
 * Envites de un lance (REGLAS_MUS.md §5, D12–D14).
 *
 * - Sin apuesta, hablan por turno desde la mano: paso, envido N u órdago. Si todos pasan, en paso.
 * - Ante una apuesta responde el siguiente rival. Si sube u ordaga, la palabra pasa a la otra
 *   pareja. Si quiere o no quiere, habla después su compañero (si tiene jugada), que puede querer,
 *   no querer, subir u ordagar. Se queda la respuesta más fuerte: subida u órdago > quiero > no quiero.
 * - El compañero de quien apostó no habla hasta que los rivales suban (FEM VI.2): aquí nunca
 *   recibe el turno antes.
 */
import type { BetAction } from '../actions.js';
import { MAX_BET, MIN_ENVIDO, MIN_REENVIDO, NEGADA_POINTS, POINTS_TO_WIN_GAME } from '../rules.js';
import { teamOf } from '../seat.js';
import type { Seat } from '../seat.js';
import type { Bet, BetResponse, LancePhase } from '../state.js';
import { emit, setPhase } from '../step.js';
import type { Step } from '../step.js';
import { defined, first } from '../invariant.js';
import { closeLance, respondersTo } from './lances.js';
import { addPoints, endHand, ordagoWinner } from './scoring.js';

function range(from: number, to: number): number[] {
  return to < from ? [] : Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Acciones legales de quien tiene la palabra en un lance. */
export function bettingActions(phase: LancePhase): BetAction[] {
  const { bet } = phase;
  if (bet === null) {
    return [
      { type: 'paso' },
      ...range(MIN_ENVIDO, MAX_BET).map((amount) => ({ type: 'envido' as const, amount })),
      { type: 'ordago' },
    ];
  }
  const responses: BetAction[] = [{ type: 'quiero' }, { type: 'noQuiero' }];
  if (bet.ordago) return responses;
  return [
    ...responses,
    ...range(MIN_REENVIDO, MAX_BET - bet.total).map((amount) => ({
      type: 'reenvido' as const,
      amount,
    })),
    { type: 'ordago' },
  ];
}

/** Aplica una acción ya validada de quien tiene la palabra. */
export function applyBet(step: Step, phase: LancePhase, seat: Seat, action: BetAction): Step {
  const spoken = emit(step, { type: 'betSpoken', seat, action });
  const { bet } = phase;
  switch (action.type) {
    case 'paso': {
      const next = phase.speakers[phase.speakers.indexOf(seat) + 1];
      return next === undefined
        ? closeLance(spoken, phase.lance, { kind: 'paso' })
        : setPhase(spoken, { ...phase, turn: next });
    }
    case 'envido':
      return placeBet(spoken, phase, seat, {
        total: action.amount,
        onReject: NEGADA_POINTS,
        raised: false,
        ordago: false,
      });
    case 'reenvido':
    case 'ordago': {
      const total = bet === null ? 0 : bet.total;
      return placeBet(spoken, phase, seat, {
        total: action.type === 'reenvido' ? total + action.amount : total,
        // Rechazar la primera apuesta es una negada; rechazar una subida, un deje (§5.3).
        onReject: bet === null ? NEGADA_POINTS : total,
        raised: bet !== null,
        ordago: action.type === 'ordago',
      });
    }
    case 'quiero':
    case 'noQuiero':
      // `applyAction` solo deja responder si hay apuesta abierta.
      return respond(spoken, phase, defined(bet, 'respuesta sin apuesta'), action.type);
  }
}

type NewBet = Pick<Bet, 'total' | 'onReject' | 'raised' | 'ordago'>;

function placeBet(step: Step, phase: LancePhase, seat: Seat, values: NewBet): Step {
  const responders = respondersTo(seat, phase.speakers);
  // Solo hay envites si las dos parejas tienen quien hable.
  const turn = first(responders, 'apuesta sin rivales que respondan');
  const bet: Bet = { ...values, team: teamOf(seat), responders, firstResponse: null };
  return setPhase(step, { ...phase, turn, bet });
}

function respond(step: Step, phase: LancePhase, bet: Bet, response: BetResponse): Step {
  const partner = bet.responders[1];
  if (bet.firstResponse === null && partner !== undefined) {
    // Habla el compañero del primer rival, aunque este haya querido (D12).
    return setPhase(step, { ...phase, turn: partner, bet: { ...bet, firstResponse: response } });
  }
  const accepted = response === 'quiero' || bet.firstResponse === 'quiero';
  if (accepted) {
    return bet.ordago
      ? resolveOrdago(step, phase)
      : closeLance(step, phase.lance, { kind: 'querido', amount: bet.total });
  }
  const scored = addPoints(
    step,
    bet.team,
    bet.onReject,
    phase.lance,
    bet.raised ? 'deje' : 'negada',
  );
  if (scored.gameOver) return endHand(scored.step, bet.team);
  return closeLance(scored.step, phase.lance, { kind: 'rechazado', team: bet.team });
}

/** Órdago aceptado: el ganador del lance gana el juego y la mano termina (§5.4). */
function resolveOrdago(step: Step, phase: LancePhase): Step {
  const winner = ordagoWinner(step.state, phase.lance);
  const team = teamOf(winner);
  const resolved = emit(step, { type: 'ordagoResolved', lance: phase.lance, winner });
  // Llega a 40 de golpe: cobra lo que le falte.
  const missing = POINTS_TO_WIN_GAME - step.state.scores[team];
  const scored = addPoints(resolved, team, missing, phase.lance, 'ordago');
  return endHand(scored.step, team);
}
