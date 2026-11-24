/**
 * Quién puede actuar y qué acciones son legales (ADR-0002 §4–5). La lista es completa y
 * concreta: `applyAction` solo acepta lo que está en ella.
 */
import type { Action } from './actions.js';
import type { Card } from './cards.js';
import { SEATS } from './seat.js';
import type { Seat } from './seat.js';
import { bettingActions } from './phases/betting.js';
import type { MatchState } from './state.js';

/** Asientos que pueden actuar ahora: uno, o varios a la vez en el descarte. */
export function pendingSeats(state: MatchState): readonly Seat[] {
  const { phase } = state.hand;
  switch (phase.kind) {
    case 'mus':
    case 'lance':
      return [phase.turn];
    case 'discard':
      return SEATS.filter((seat) => phase.discards[seat] === null);
    case 'handOver':
      return [];
  }
}

export type MusAction = Extract<Action, { type: 'mus' | 'corto' }>;
export type DiscardAction = Extract<Action, { type: 'discard' }>;

export const MUS_OPTIONS: readonly MusAction[] = [{ type: 'mus' }, { type: 'corto' }];

/**
 * Todos los descartes posibles: cualquier subconjunto no vacío de la mano, de 1 a 4 cartas
 * (`MAX_DISCARD` = `HAND_SIZE`): 15 opciones.
 */
export function discardOptions(hand: readonly Card[]): DiscardAction[] {
  return Array.from({ length: (1 << hand.length) - 1 }, (_, i) => ({
    type: 'discard' as const,
    cards: hand.filter((_card, bit) => ((i + 1) & (1 << bit)) !== 0),
  }));
}

/** Acciones legales de `seat`; vacía si no le toca actuar. */
export function getLegalActions(state: MatchState, seat: Seat): readonly Action[] {
  const { phase, hands } = state.hand;
  switch (phase.kind) {
    case 'mus':
      return phase.turn === seat ? MUS_OPTIONS : [];
    case 'discard':
      return phase.discards[seat] === null ? discardOptions(hands[seat]) : [];
    case 'lance':
      return phase.turn === seat ? bettingActions(phase) : [];
    case 'handOver':
      return [];
  }
}
