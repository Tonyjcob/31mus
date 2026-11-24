// Caídas de conexión, reconexión (D7) y chat y reacciones con límite (D21), con clientes reales.
import { createSeededRng } from '@31mus/engine';
import {
  CHAT_RATE,
  CLIENT_MESSAGES,
  MAX_CLIENT_MESSAGES_PER_SECOND,
  REACTION_RATE,
  SERVER_MESSAGES,
  type ChatMessage,
  type ReactionMessage,
  type RoomErrorMessage,
} from '@31mus/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { TableTiming } from '../table/table-session.js';
import {
  TestClient,
  as,
  startTestServer,
  waitUntil,
  type TestBench,
} from '../testing/test-server.js';

const TIMING: Partial<TableTiming> = {
  turnMs: 400,
  botDelayMinMs: 1,
  botDelayMaxMs: 3,
  handPauseMs: 5,
  emptyRoomMs: 1_000,
};

let bench: TestBench;

beforeAll(async () => {
  bench = await startTestServer({ timing: TIMING });
});

afterEach(async () => {
  await bench.colyseus.cleanup();
});

afterAll(async () => {
  await bench.shutdown();
});

/** Partida de dos humanos (asientos 0 y 2) contra dos bots, ya empezada. */
async function duo(): Promise<[TestClient, TestClient]> {
  const ana = await TestClient.create(bench, as('ana', { mode: 'duo_vs_bots' }));
  const bea = await TestClient.join(bench, ana.roomId, as('bea'));
  ana.send(CLIENT_MESSAGES.takeSeat, { seat: 0 });
  bea.send(CLIENT_MESSAGES.takeSeat, { seat: 2 });
  await waitUntil(() => (ana.state.status === 'playing' ? true : undefined));
  return [ana, bea];
}

function seatConnected(client: TestClient, seat: number): boolean | undefined {
  return client.state.seats.map((s) => s.connected)[seat];
}

describe('caída y reconexión (D7)', () => {
  it('el bot juega por quien cae y este vuelve a su asiento con la misma sesión', async () => {
    const [ana, bea] = await duo();
    await bea.drop();
    await waitUntil(() => (seatConnected(ana, 2) === false ? true : undefined));
    expect(ana.state.status).toBe('playing');
    const before = ana.view()?.version ?? 0;
    ana.autoPlay(createSeededRng(7));
    await waitUntil(() => ((ana.view()?.version ?? 0) > before + 5 ? true : undefined), 5_000);

    const back = await TestClient.reconnect(bench, bea);
    expect(await back.waitFor(SERVER_MESSAGES.you)).toMatchObject({ role: 'player', seat: 2 });
    const view = await back.waitFor<{ view: { ownCards: unknown } }>(SERVER_MESSAGES.view);
    expect(view.view.ownCards).not.toBeNull();
    await waitUntil(() => (seatConnected(ana, 2) === true ? true : undefined));
  });

  it('si vuelve con una sesión nueva, la antigua ya no puede reconectar', async () => {
    const [ana, bea] = await duo();
    await bea.drop();
    await waitUntil(() => (seatConnected(ana, 2) === false ? true : undefined));
    const fresh = await TestClient.join(bench, ana.roomId, as('bea'));
    expect(await fresh.waitFor(SERVER_MESSAGES.you)).toMatchObject({ seat: 2 });
    await waitUntil(() => (seatConnected(ana, 2) === true ? true : undefined));
    await expect(TestClient.reconnect(bench, bea)).rejects.toThrow();
    expect(seatConnected(ana, 2)).toBe(true);
  });

  it('si caen todos, la partida se pausa; al reconectar uno, sigue', async () => {
    const [ana, bea] = await duo();
    const eva = await TestClient.join(bench, ana.roomId, as('eva', { role: 'spectator' }));
    await ana.drop();
    await bea.drop();
    await waitUntil(() => (eva.state.status === 'paused' ? true : undefined));
    await TestClient.reconnect(bench, ana);
    await waitUntil(() => (eva.state.status === 'playing' ? true : undefined));
  });

  it('en el lobby una caída libera el asiento', async () => {
    const ana = await TestClient.create(bench, as('ana', { mode: '2v2' }));
    const bea = await TestClient.join(bench, ana.roomId, as('bea'));
    bea.send(CLIENT_MESSAGES.takeSeat, { seat: 1 });
    await waitUntil(() => (ana.state.seats.map((s) => s.kind)[1] === 'human' ? true : undefined));
    await bea.drop();
    await waitUntil(() => (ana.state.seats.map((s) => s.kind)[1] === 'empty' ? true : undefined));
  });
});

describe('chat y reacciones', () => {
  it('difunde a jugadores y espectadores con el autor que pone el servidor', async () => {
    const [ana, bea] = await duo();
    const eva = await TestClient.join(bench, ana.roomId, as('eva', { role: 'spectator' }));
    ana.send(CLIENT_MESSAGES.chat, { text: '  ¡vamos,   pareja! ' });
    for (const client of [ana, bea, eva]) {
      expect(await client.waitFor<ChatMessage>(SERVER_MESSAGES.chat)).toMatchObject({
        from: { nickname: 'ana', role: 'player', seat: 0 },
        text: '¡vamos, pareja!',
      });
    }
    eva.send(CLIENT_MESSAGES.reaction, { emoji: '🔥' });
    expect(await bea.waitFor<ReactionMessage>(SERVER_MESSAGES.reaction)).toMatchObject({
      from: { nickname: 'eva', role: 'spectator', seat: null },
      emoji: '🔥',
    });
  });

  it('rechaza lo que no es válido y aplica el límite de cada uno', async () => {
    const ana = await TestClient.create(bench, as('ana', { mode: '2v2' }));
    const errors = (): string[] =>
      ana.messages<RoomErrorMessage>(SERVER_MESSAGES.error).map((e) => e.code);
    ana.send(CLIENT_MESSAGES.chat, { text: 'a‮b' });
    ana.send(CLIENT_MESSAGES.reaction, { emoji: '💩' });
    await waitUntil(() => (errors().length === 2 ? true : undefined));
    expect(errors()).toEqual(['INVALID_MESSAGE', 'INVALID_MESSAGE']);

    for (let i = 0; i <= CHAT_RATE.max; i++)
      ana.send(CLIENT_MESSAGES.chat, { text: `m${String(i)}` });
    for (let i = 0; i <= REACTION_RATE.max; i++)
      ana.send(CLIENT_MESSAGES.reaction, { emoji: '👍' });
    await waitUntil(() => (errors().length === 4 ? true : undefined));
    expect(errors().slice(2)).toEqual(['RATE_LIMITED', 'RATE_LIMITED']);
    expect(ana.messages(SERVER_MESSAGES.chat)).toHaveLength(CHAT_RATE.max);
    expect(ana.messages(SERVER_MESSAGES.reaction)).toHaveLength(REACTION_RATE.max);
  });

  it('desconecta a quien inunda la sala de mensajes', async () => {
    const ana = await TestClient.create(bench, as('ana', { mode: '2v2' }));
    ana.room.reconnection.enabled = false;
    for (let i = 0; i <= MAX_CLIENT_MESSAGES_PER_SECOND * 2; i++) {
      ana.send(CLIENT_MESSAGES.reaction, { emoji: '👍' });
    }
    await waitUntil(() => ana.leftWith ?? undefined, 3_000, 'la desconexión');
  });
});
