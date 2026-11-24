/**
 * Bot medio (ADR-0003 §3): decide con la vista de su asiento y las acciones legales, con el estilo
 * de su personaje. Es una función pura: misma entrada y misma semilla, misma acción.
 */
import type { Action, Card, PlayerView, Seat } from '@31mus/engine';

import { answerBet, openBet } from './betting.js';
import { requireAction } from './choose.js';
import { tieShare } from './odds.js';
import { lanceWinChance, pressure } from './situation.js';
import { CUT_STYLE_SPREAD, CUT_THRESHOLD, NEUTRAL_TRAIT } from './tuning.js';
import type { BotDecision, BotInput } from './types.js';
import { discardValue, handValue } from './value.js';

type DiscardAction = Extract<Action, { type: 'discard' }>;

function decideMus(view: PlayerView, seat: Seat, hand: readonly Card[], input: BotInput): Action {
  const threshold =
    CUT_THRESHOLD - (input.persona.style.cutTendency - NEUTRAL_TRAIT) * CUT_STYLE_SPREAD;
  const cut = handValue(hand, tieShare(seat, view.mano)) >= threshold;
  return requireAction(input.legal, cut ? 'corto' : 'mus');
}

/** El descarte con mayor valor esperado tras robar (a igualdad, el primero). */
function decideDiscard(
  view: PlayerView,
  seat: Seat,
  hand: readonly Card[],
  legal: readonly Action[],
): Action {
  const ties = tieShare(seat, view.mano);
  const options = legal.filter((a): a is DiscardAction => a.type === 'discard');
  const scored = options.map((action) => ({
    action,
    value: discardValue(hand, action.cards, ties),
  }));
  const best = scored.reduce<(typeof scored)[number] | null>(
    (top, option) => (top === null || option.value > top.value ? option : top),
    null,
  );
  return best?.action ?? requireAction(legal, 'discard');
}

export function decideAction(input: BotInput): BotDecision {
  const { view, legal, persona, rng } = input;
  const seat = view.viewer;
  const hand = view.ownCards;
  if (seat === 'spectator' || hand === null) throw new RangeError('Un bot juega en un asiento.');
  const { phase } = view;
  switch (phase.kind) {
    case 'mus':
      return { action: decideMus(view, seat, hand, input), bluff: false };
    case 'discard':
      return { action: decideDiscard(view, seat, hand, legal), bluff: false };
    case 'lance': {
      const ctx = {
        view,
        seat,
        legal,
        style: persona.style,
        rng,
        chance: lanceWinChance(phase, hand, seat, view.mano),
        pressure: pressure(view),
      };
      return phase.bet === null ? openBet(ctx) : answerBet(ctx, phase.bet);
    }
    case 'handOver':
      throw new RangeError('Con la mano terminada no se decide nada.');
  }
}
