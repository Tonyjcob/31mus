/** Elegir entre las acciones legales: el bot nunca construye una acción que no esté en la lista. */
import type { Action } from '@31mus/engine';

type ActionOf<T extends Action['type']> = Extract<Action, { type: T }>;
type AmountAction = ActionOf<'envido' | 'reenvido'>;

/** La primera acción legal de ese tipo, o `null` si no la hay. */
export function findAction<T extends Action['type']>(
  legal: readonly Action[],
  type: T,
): ActionOf<T> | null {
  return (legal.find((a) => a.type === type) as ActionOf<T> | undefined) ?? null;
}

/** Como `findAction`, cuando las reglas garantizan que existe (si no, es un error de uso). */
export function requireAction<T extends Action['type']>(
  legal: readonly Action[],
  type: T,
): ActionOf<T> {
  const action = findAction(legal, type);
  if (action === null) throw new RangeError(`No hay ninguna acción legal «${type}».`);
  return action;
}

/** El envite o la subida legal cuya cantidad más se acerca a `amount` (a igualdad, la menor). */
export function closestAmount(
  legal: readonly Action[],
  type: AmountAction['type'],
  amount: number,
): AmountAction | null {
  const distance = (a: AmountAction) => Math.abs(a.amount - amount);
  return legal
    .filter((a): a is AmountAction => a.type === type)
    .reduce<AmountAction | null>(
      (best, a) => (best === null || distance(a) < distance(best) ? a : best),
      null,
    );
}

/** Como `closestAmount`, cuando las reglas garantizan que hay alguna (envidar sin apuesta). */
export function requireAmount(
  legal: readonly Action[],
  type: AmountAction['type'],
  amount: number,
): AmountAction {
  const action = closestAmount(legal, type, amount);
  if (action === null) throw new RangeError(`No hay ninguna acción legal «${type}».`);
  return action;
}
