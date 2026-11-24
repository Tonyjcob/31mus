/**
 * Bot aleatorio de referencia (ADR-0003 §5): elige cualquier acción legal con la misma
 * probabilidad. Lo usan los tests de los bots y los del servidor de juego.
 */
import type { Action, Rng } from '@31mus/engine';

export function randomAction(legal: readonly Action[], rng: Rng): Action {
  const [action] = legal.slice(rng.nextInt(Math.max(1, legal.length)));
  if (action === undefined) throw new RangeError('No hay acciones legales entre las que elegir.');
  return action;
}
