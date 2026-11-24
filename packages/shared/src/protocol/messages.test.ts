import { describe, expect, it } from 'vitest';

import { REACTIONS } from '../constants.js';
import {
  CLIENT_MESSAGES,
  SERVER_MESSAGES,
  chatSendSchema,
  chooseBotSchema,
  createRoomOptionsSchema,
  devIdentitySchema,
  gameActionSchema,
  joinRoomOptionsSchema,
  leaveSeatSchema,
  reactionSendSchema,
  takeSeatSchema,
} from './messages.js';

const ACTION_ID = '3f1c2a8e-6b7d-4e0f-9a1b-2c3d4e5f6a7b';

describe('opciones de sala', () => {
  it('crear: solo modos casuales; pública por defecto', () => {
    expect(createRoomOptionsSchema.parse({ mode: 'solo' })).toEqual({
      mode: 'solo',
      visibility: 'public',
    });
    expect(createRoomOptionsSchema.parse({ mode: '2v2', visibility: 'private' }).visibility).toBe(
      'private',
    );
    expect(createRoomOptionsSchema.safeParse({ mode: 'ranked' }).success).toBe(false);
    expect(createRoomOptionsSchema.safeParse({}).success).toBe(false);
  });

  it('unirse: jugador por defecto; el código se normaliza; ignora otras opciones', () => {
    expect(joinRoomOptionsSchema.parse({})).toEqual({ role: 'player' });
    expect(
      joinRoomOptionsSchema.parse({ role: 'spectator', code: 'abc234', userId: 'u1' }),
    ).toEqual({ role: 'spectator', code: 'ABC234' });
    expect(joinRoomOptionsSchema.safeParse({ role: 'admin' }).success).toBe(false);
    expect(joinRoomOptionsSchema.safeParse({ code: '000000' }).success).toBe(false);
  });

  it('identidad de desarrollo: userId y apodo válidos', () => {
    expect(devIdentitySchema.parse({ userId: 'u1', nickname: ' Ana ', role: 'player' })).toEqual({
      userId: 'u1',
      nickname: 'Ana',
    });
    expect(devIdentitySchema.safeParse({ userId: 'u1' }).success).toBe(false);
    expect(devIdentitySchema.safeParse({ userId: 'u 1', nickname: 'Ana' }).success).toBe(false);
  });
});

describe('mensajes del cliente', () => {
  it('los nombres de mensaje no se repiten', () => {
    const names = [...Object.values(CLIENT_MESSAGES), ...Object.values(SERVER_MESSAGES)];
    expect(new Set(names).size).toBe(names.length);
  });

  it('asiento y bots', () => {
    expect(takeSeatSchema.parse({ seat: 2 })).toEqual({ seat: 2 });
    expect(takeSeatSchema.safeParse({ seat: 4 }).success).toBe(false);
    expect(leaveSeatSchema.parse({})).toEqual({});
    expect(leaveSeatSchema.safeParse({ seat: 1 }).success).toBe(false);
    expect(chooseBotSchema.parse({ seat: 1, personaId: 'abuelo' })).toEqual({
      seat: 1,
      personaId: 'abuelo',
    });
    expect(chooseBotSchema.safeParse({ seat: 1, personaId: '<x>' }).success).toBe(false);
  });

  it('acción de juego con actionId UUID y versión', () => {
    const message = { actionId: ACTION_ID, version: 7, action: { type: 'envido', amount: 2 } };
    expect(gameActionSchema.parse(message)).toEqual(message);
    for (const bad of [
      { ...message, actionId: 'x' },
      { ...message, version: -1 },
      { ...message, version: 1.5 },
      { ...message, action: { type: 'envido', amount: 0 } },
      { ...message, seat: 0 },
      { actionId: ACTION_ID, version: 0 },
    ]) {
      expect(gameActionSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('chat y reacciones', () => {
    expect(chatSendSchema.parse({ text: ' hola ' })).toEqual({ text: 'hola' });
    expect(chatSendSchema.safeParse({ text: '' }).success).toBe(false);
    expect(chatSendSchema.safeParse({ text: 'hola', from: 'otro' }).success).toBe(false);
    for (const emoji of REACTIONS) {
      expect(reactionSendSchema.parse({ emoji })).toEqual({ emoji });
    }
    expect(reactionSendSchema.safeParse({ emoji: '💩' }).success).toBe(false);
    expect(reactionSendSchema.safeParse({ emoji: '👏👏' }).success).toBe(false);
  });
});
