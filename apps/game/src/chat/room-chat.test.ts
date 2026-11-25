import { CHAT_RATE, REACTION_RATE, type MessageAuthor } from '@31mus/shared';
import { describe, expect, it } from 'vitest';

import { FakeScheduler } from '../testing/fake-scheduler.js';
import { RoomChat } from './room-chat.js';

const ANA: MessageAuthor = { nickname: 'ana', role: 'player', seat: 0 };

function setup(): { chat: RoomChat; clock: FakeScheduler } {
  const clock = new FakeScheduler(1_000);
  let n = 0;
  return { chat: new RoomChat(clock, () => `id-${String(++n)}`), clock };
}

describe('RoomChat', () => {
  it('sanea el texto y pone el autor y la hora del servidor', () => {
    const { chat } = setup();
    expect(chat.message('ana', ANA, { text: '  hola\n\n  a   todos ' })).toEqual({
      ok: true,
      message: { id: 'id-1', from: ANA, text: 'hola a todos', at: 1_000 },
    });
  });

  it('rechaza mensajes vacíos, largos, con control o con campos de más', () => {
    const { chat } = setup();
    for (const payload of [
      { text: '   ' },
      { text: 'x'.repeat(201) },
      { text: 'a\u0007b' },
      { text: 'hola', nickname: 'admin' },
      'hola',
      null,
    ]) {
      expect(chat.message('ana', ANA, payload)).toEqual({ ok: false, code: 'INVALID_MESSAGE' });
    }
  });

  it('limita el chat a 5 mensajes cada 10 s por usuario', () => {
    const { chat, clock } = setup();
    for (let i = 0; i < CHAT_RATE.max; i++) {
      expect(chat.message('ana', ANA, { text: `m${String(i)}` }).ok).toBe(true);
    }
    expect(chat.message('ana', ANA, { text: 'otro' })).toEqual({ ok: false, code: 'RATE_LIMITED' });
    expect(chat.message('bea', ANA, { text: 'yo sí' }).ok).toBe(true);
    clock.advance(CHAT_RATE.windowMs);
    expect(chat.message('ana', ANA, { text: 'ya' }).ok).toBe(true);
  });

  it('solo admite reacciones de la lista y 3 cada 5 s', () => {
    const { chat, clock } = setup();
    expect(chat.reaction('ana', ANA, { emoji: '💩' })).toEqual({
      ok: false,
      code: 'INVALID_MESSAGE',
    });
    for (let i = 0; i < REACTION_RATE.max; i++) {
      expect(chat.reaction('ana', ANA, { emoji: '👏' })).toEqual({
        ok: true,
        message: { from: ANA, emoji: '👏', at: 1_000 },
      });
    }
    expect(chat.reaction('ana', ANA, { emoji: '🔥' })).toEqual({ ok: false, code: 'RATE_LIMITED' });
    expect(chat.message('ana', ANA, { text: 'el chat va aparte' }).ok).toBe(true);
    clock.advance(REACTION_RATE.windowMs);
    expect(chat.reaction('ana', ANA, { emoji: '🔥' }).ok).toBe(true);
  });
});
