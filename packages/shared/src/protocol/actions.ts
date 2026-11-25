// Esquemas Zod de las cartas, los asientos y las acciones que envía un cliente (ADR-0004 §7).
// `shared` solo puede importar *tipos* de `engine`: los valores se repiten aquí y los tests
// comprueban en tiempo de compilación que los tipos coinciden con los del motor.
import { z } from 'zod';

import { MAX_ACTION_AMOUNT } from '../constants.js';

const SUIT_VALUES = ['oros', 'copas', 'espadas', 'bastos'] as const;
const RANK_VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;

/** Las 40 cartas válidas en el formato del motor (`palo-número`). */
type CardValue = `${(typeof SUIT_VALUES)[number]}-${(typeof RANK_VALUES)[number]}`;
const CARD_VALUES = SUIT_VALUES.flatMap((suit) =>
  RANK_VALUES.map((rank) => `${suit}-${String(rank)}` as CardValue),
);

/** Máximo de cartas en un descarte (`MAX_DISCARD` del motor). */
const MAX_DISCARD_CARDS = 4;

export const cardSchema = z.enum(CARD_VALUES as [CardValue, ...CardValue[]]);

export const seatSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

const amountSchema = z.number().int().min(1).max(MAX_ACTION_AMOUNT);

export const betActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('paso') }),
  z.strictObject({ type: z.literal('envido'), amount: amountSchema }),
  z.strictObject({ type: z.literal('reenvido'), amount: amountSchema }),
  z.strictObject({ type: z.literal('quiero') }),
  z.strictObject({ type: z.literal('noQuiero') }),
  z.strictObject({ type: z.literal('ordago') }),
]);

export const actionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('mus') }),
  z.strictObject({ type: z.literal('corto') }),
  z.strictObject({
    type: z.literal('discard'),
    cards: z
      .array(cardSchema)
      .min(1)
      .max(MAX_DISCARD_CARDS)
      .refine((cards) => new Set(cards).size === cards.length, 'Cartas repetidas')
      .readonly(),
  }),
  ...betActionSchema.options,
]);
