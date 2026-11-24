// Contratos entre `shared` (lo que se acepta del cliente) y el motor (lo que es legal). `shared` no
// puede importar valores de `engine` (CLAUDE.md §4), así que la coherencia se comprueba aquí, donde
// se usan los dos.
import { FULL_DECK, MAX_BET, MIN_ENVIDO } from '@31mus/engine';
import { MAX_ACTION_AMOUNT, actionSchema, cardSchema } from '@31mus/shared';
import { describe, expect, it } from 'vitest';

describe('contratos shared ↔ engine', () => {
  it('el tope de cantidades del protocolo es el MAX_BET del motor', () => {
    expect(MAX_ACTION_AMOUNT).toBe(MAX_BET);
  });

  it('el esquema admite todos los envites legales y nada por encima', () => {
    for (let amount = MIN_ENVIDO; amount <= MAX_BET; amount++) {
      expect(actionSchema.safeParse({ type: 'envido', amount }).success).toBe(true);
    }
    expect(actionSchema.safeParse({ type: 'envido', amount: MAX_BET + 1 }).success).toBe(false);
  });

  it('el esquema de cartas es exactamente la baraja del motor', () => {
    expect(cardSchema.options).toEqual([...FULL_DECK]);
    expect(cardSchema.safeParse('oros-8').success).toBe(false);
  });
});
