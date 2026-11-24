/** Fase de mus (REGLAS_MUS.md §3.2, D11): mano → 2.º → 3.º → postre; cualquiera puede cortar. */
import { nextSeat } from '../seat.js';
import type { Seat } from '../seat.js';
import { emit, setPhase } from '../step.js';
import type { Step } from '../step.js';
import { startLance } from './lances.js';

export function applyMus(step: Step, seat: Seat, choice: 'mus' | 'corto'): Step {
  const spoken = emit(step, { type: 'musSpoken', seat, choice });
  if (choice === 'corto') {
    // La grande empieza siempre por la mano, corte quien corte.
    return startLance(spoken, 'grande');
  }
  const next = nextSeat(seat);
  if (next === step.state.mano) {
    // Los cuatro han dicho mus: descarte en paralelo.
    return setPhase(spoken, { kind: 'discard', discards: [null, null, null, null] });
  }
  return setPhase(spoken, { kind: 'mus', turn: next });
}
