/**
 * Punto de entrada de las acciones de los jugadores (CLAUDE.md §6). Valida contra las acciones
 * legales de la fase (única fuente de verdad, ADR-0002 §4) y aplica la opción legal encontrada.
 */
import { sameAction } from './actions.js';
import type { Action } from './actions.js';
import { musError } from './errors.js';
import type { MusError } from './errors.js';
import { MUS_OPTIONS, discardOptions } from './legal-actions.js';
import { applyBet, bettingActions } from './phases/betting.js';
import { applyDiscard } from './phases/discard.js';
import { applyMus } from './phases/mus.js';
import { err, ok } from './result.js';
import type { Result } from './result.js';
import type { Rng } from './rng.js';
import type { Seat } from './seat.js';
import type { MatchState } from './state.js';
import { startStep } from './step.js';
import type { Step } from './step.js';

type Applied = Result<Step, MusError>;

const notYourTurn = (): Applied =>
  err(musError('NOT_YOUR_TURN', 'No le toca actuar a este asiento.'));

/** Aplica la opción legal que coincide con `action`, o devuelve `ILLEGAL_ACTION`. */
function withLegal<T extends Action>(
  options: readonly T[],
  action: Action,
  apply: (legal: T) => Step,
): Applied {
  const legal = options.find((option) => sameAction(option, action));
  return legal === undefined
    ? err(musError('ILLEGAL_ACTION', `Acción no permitida ahora: ${action.type}.`))
    : ok(apply(legal));
}

export function applyAction(
  state: MatchState,
  seat: Seat,
  action: Action,
  ctx: { rng: Rng },
): Applied {
  if (state.matchWinner !== null) {
    return err(musError('MATCH_OVER', 'La partida ha terminado.'));
  }
  const step = startStep(state);
  const { phase, hands } = state.hand;
  switch (phase.kind) {
    case 'mus':
      if (phase.turn !== seat) return notYourTurn();
      return withLegal(MUS_OPTIONS, action, (legal) => applyMus(step, seat, legal.type));
    case 'discard':
      if (phase.discards[seat] !== null) return notYourTurn();
      return withLegal(discardOptions(hands[seat]), action, (legal) =>
        applyDiscard(step, phase, seat, legal.cards, ctx.rng),
      );
    case 'lance':
      if (phase.turn !== seat) return notYourTurn();
      return withLegal(bettingActions(phase), action, (legal) =>
        applyBet(step, phase, seat, legal),
      );
    case 'handOver':
      return notYourTurn();
  }
}
