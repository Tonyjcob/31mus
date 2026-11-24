/**
 * Un paso de la máquina de estados: el estado resultante y los eventos emitidos por el camino.
 * Las transiciones encadenan pasos sin mutar nada.
 */
import type { GameEvent } from './events.js';
import type { HandState, MatchState, Phase } from './state.js';

export interface Step {
  readonly state: MatchState;
  readonly events: readonly GameEvent[];
}

export function startStep(state: MatchState): Step {
  return { state, events: [] };
}

export function emit(step: Step, ...events: readonly GameEvent[]): Step {
  return { state: step.state, events: [...step.events, ...events] };
}

export function updateState(step: Step, patch: Partial<MatchState>): Step {
  return { state: { ...step.state, ...patch }, events: step.events };
}

export function updateHand(step: Step, patch: Partial<HandState>): Step {
  return updateState(step, { hand: { ...step.state.hand, ...patch } });
}

export function setPhase(step: Step, phase: Phase): Step {
  return updateHand(step, { phase });
}
