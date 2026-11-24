import type { Action, BetAction, Card, Seat } from '@31mus/engine';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';

import { MAX_ACTION_AMOUNT } from '../constants.js';
import { actionSchema, betActionSchema, cardSchema, seatSchema } from './actions.js';

type Extends<A, B> = [A] extends [B] ? true : false;

describe('tipos alineados con el motor', () => {
  it('cartas, asientos y acciones validados son exactamente los del motor', () => {
    expectTypeOf<z.output<typeof cardSchema>>().toEqualTypeOf<Card>();
    expectTypeOf<z.output<typeof seatSchema>>().toEqualTypeOf<Seat>();
    expectTypeOf<Extends<z.output<typeof betActionSchema>, BetAction>>().toEqualTypeOf<true>();
    expectTypeOf<Extends<BetAction, z.input<typeof betActionSchema>>>().toEqualTypeOf<true>();
    expectTypeOf<Extends<z.output<typeof actionSchema>, Action>>().toEqualTypeOf<true>();
    expectTypeOf<Extends<Action, z.input<typeof actionSchema>>>().toEqualTypeOf<true>();
  });
});

describe('cardSchema', () => {
  it('admite las 40 cartas y nada más', () => {
    expect(cardSchema.options).toHaveLength(40);
    expect(new Set(cardSchema.options).size).toBe(40);
    for (const card of ['oros-1', 'copas-3', 'espadas-10', 'bastos-12']) {
      expect(cardSchema.safeParse(card).success).toBe(true);
    }
    for (const card of ['oros-8', 'oros-9', 'copas-13', 'Oros-1', 'oros1', '', 1, null]) {
      expect(cardSchema.safeParse(card).success).toBe(false);
    }
  });
});

describe('seatSchema', () => {
  it('admite 0–3 enteros', () => {
    expect([0, 1, 2, 3].every((seat) => seatSchema.safeParse(seat).success)).toBe(true);
    for (const seat of [-1, 4, 1.5, '1', null]) {
      expect(seatSchema.safeParse(seat).success).toBe(false);
    }
  });
});

describe('actionSchema', () => {
  it('admite cada tipo de acción bien formada', () => {
    const valid: Action[] = [
      { type: 'mus' },
      { type: 'corto' },
      { type: 'discard', cards: ['oros-1'] },
      { type: 'discard', cards: ['oros-1', 'copas-2', 'espadas-3', 'bastos-4'] },
      { type: 'paso' },
      { type: 'envido', amount: 2 },
      { type: 'reenvido', amount: MAX_ACTION_AMOUNT },
      { type: 'quiero' },
      { type: 'noQuiero' },
      { type: 'ordago' },
    ];
    for (const action of valid) {
      expect(actionSchema.parse(action)).toEqual(action);
    }
  });

  it('betActionSchema solo admite apuestas', () => {
    expect(betActionSchema.safeParse({ type: 'ordago' }).success).toBe(true);
    expect(betActionSchema.safeParse({ type: 'mus' }).success).toBe(false);
    expect(betActionSchema.safeParse({ type: 'discard', cards: ['oros-1'] }).success).toBe(false);
  });

  it('rechaza tipos desconocidos, campos de más y cantidades fuera de rango', () => {
    const invalid: unknown[] = [
      { type: 'trampa' },
      { type: 'mus', extra: true },
      { type: 'envido' },
      { type: 'envido', amount: 0 },
      { type: 'envido', amount: 2.5 },
      { type: 'envido', amount: MAX_ACTION_AMOUNT + 1 },
      { type: 'reenvido', amount: -1 },
      { type: 'quiero', amount: 2 },
      'mus',
      null,
    ];
    for (const action of invalid) {
      expect(actionSchema.safeParse(action).success).toBe(false);
    }
  });

  it('rechaza descartes vacíos, de más de 4, repetidos o con cartas falsas', () => {
    const invalid: unknown[] = [
      { type: 'discard', cards: [] },
      { type: 'discard', cards: ['oros-1', 'oros-2', 'oros-3', 'oros-4', 'oros-5'] },
      { type: 'discard', cards: ['oros-1', 'oros-1'] },
      { type: 'discard', cards: ['oros-9'] },
      { type: 'discard' },
    ];
    for (const action of invalid) {
      expect(actionSchema.safeParse(action).success).toBe(false);
    }
  });
});
