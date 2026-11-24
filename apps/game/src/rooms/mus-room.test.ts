// Integración del lobby con clientes reales (CLAUDE.md §7, ADR-0004 §8).
import {
  CLIENT_MESSAGES,
  MAX_SPECTATORS,
  PRIVATE_CODE_MAX_FAILS,
  SERVER_MESSAGES,
  type RoomErrorMessage,
} from '@31mus/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  TestClient,
  as,
  startTestServer,
  waitUntil,
  type TestBench,
} from '../testing/test-server.js';
import type { MusRoom } from './mus-room.js';

let bench: TestBench;

beforeAll(async () => {
  bench = await startTestServer();
});

afterEach(async () => {
  await bench.colyseus.cleanup();
});

afterAll(async () => {
  await bench.shutdown();
});

function serverRoom(client: TestClient): MusRoom {
  return bench.colyseus.getRoomById<MusRoom>(client.roomId);
}

function errorCodes(client: TestClient): string[] {
  return client.messages<RoomErrorMessage>(SERVER_MESSAGES.error).map((m) => m.code);
}

async function waitForError(client: TestClient, code: string): Promise<void> {
  await client.waitFor<RoomErrorMessage>(SERVER_MESSAGES.error, (m) => m.code === code);
}

describe('crear sala', () => {
  it('solo: el creador se sienta en el 0 y empieza al instante contra tres bots', async () => {
    const ana = await TestClient.create(bench, as('ana', { mode: 'solo' }));
    expect(await ana.waitFor(SERVER_MESSAGES.you)).toEqual({ role: 'player', seat: 0, code: null });
    await waitUntil(() => (ana.state.status === 'playing' ? true : undefined));
    const seats = ana.state.seats.map((s) => s.kind);
    expect(seats).toEqual(['human', 'bot', 'bot', 'bot']);
    expect(serverRoom(ana).metadata).toMatchObject({
      mode: 'solo',
      visibility: 'public',
      hasCode: false,
      seatsTaken: 1,
      status: 'playing',
    });
  });

  it('usa los personajes elegidos al crear', async () => {
    const ana = await TestClient.create(
      bench,
      as('ana', { mode: 'solo', bots: { partner: 'abuelo', rivals: ['pollo', 'faraona'] } }),
    );
    await waitUntil(() => (ana.state.status === 'playing' ? true : undefined));
    const personas = ana.state.seats.map((s) => s.personaId);
    expect(personas).toEqual(['', 'pollo', 'abuelo', 'faraona']);
  });

  it('rechaza opciones inválidas, personajes desconocidos y falta de identidad', async () => {
    await expect(TestClient.create(bench, as('ana', { mode: 'ranked' }))).rejects.toThrow(
      'INVALID_OPTIONS',
    );
    await expect(
      TestClient.create(bench, as('ana', { mode: 'solo', bots: { partner: 'fantasma' } })),
    ).rejects.toThrow('UNKNOWN_PERSONA');
    await expect(TestClient.create(bench, { mode: 'solo' })).rejects.toThrow('INVALID_IDENTITY');
  });
});

describe('asientos', () => {
  it('duo_vs_bots: misma pareja, empieza con dos humanos y bots rivales', async () => {
    const ana = await TestClient.create(
      bench,
      as('ana', { mode: 'duo_vs_bots', bots: { rivals: ['abuelo', 'rosario'] } }),
    );
    expect(await ana.waitFor(SERVER_MESSAGES.you)).toMatchObject({ seat: null });
    ana.send(CLIENT_MESSAGES.takeSeat, { seat: 1 });
    await ana.waitFor(SERVER_MESSAGES.you, (m: { seat: number | null }) => m.seat === 1);

    const bea = await TestClient.join(bench, ana.roomId, as('bea'));
    bea.send(CLIENT_MESSAGES.takeSeat, { seat: 0 });
    await waitForError(bea, 'SEAT_NOT_ALLOWED');
    bea.send(CLIENT_MESSAGES.takeSeat, { seat: 1 });
    await waitForError(bea, 'SEAT_TAKEN');
    expect(ana.state.status).toBe('lobby');

    bea.send(CLIENT_MESSAGES.takeSeat, { seat: 3 });
    await waitUntil(() => (ana.state.status === 'playing' ? true : undefined));
    const personas = ana.state.seats.map((s) => s.personaId);
    expect(personas).toEqual(['abuelo', '', 'rosario', '']);
  });

  it('2v2: el quinto jugador no entra y nadie entra a jugar tras empezar', async () => {
    const players = [await TestClient.create(bench, as('p0', { mode: '2v2' }))];
    const roomId = players[0]?.roomId ?? '';
    for (const id of ['p1', 'p2', 'p3']) players.push(await TestClient.join(bench, roomId, as(id)));
    await expect(TestClient.join(bench, roomId, as('p4'))).rejects.toThrow('PLAYERS_FULL');
    players.forEach((p, seat) => {
      p.send(CLIENT_MESSAGES.takeSeat, { seat });
    });
    await waitUntil(() => (players[0]?.state.status === 'playing' ? true : undefined));
    await players[3]?.leave();
    await expect(TestClient.join(bench, roomId, as('p5'))).rejects.toThrow('NOT_IN_LOBBY');
  });

  it('levantarse o salir de la sala libera el asiento en el lobby', async () => {
    const ana = await TestClient.create(bench, as('ana', { mode: '2v2' }));
    const bea = await TestClient.join(bench, ana.roomId, as('bea'));
    ana.send(CLIENT_MESSAGES.takeSeat, { seat: 0 });
    bea.send(CLIENT_MESSAGES.takeSeat, { seat: 2 });
    await waitUntil(() => (serverRoom(ana).metadata.seatsTaken === 2 ? true : undefined));
    ana.send(CLIENT_MESSAGES.leaveSeat, {});
    await ana.waitFor(SERVER_MESSAGES.you, (m: { seat: number | null }) => m.seat === null);
    await bea.leave();
    await waitUntil(() => (serverRoom(ana).metadata.seatsTaken === 0 ? true : undefined));
    expect(ana.state.seats.map((s) => s.kind)).toEqual(['empty', 'empty', 'empty', 'empty']);
  });

  it('responde INVALID_MESSAGE a mensajes mal formados o desconocidos', async () => {
    const ana = await TestClient.create(bench, as('ana', { mode: '2v2' }));
    ana.send(CLIENT_MESSAGES.takeSeat, { seat: 7 });
    ana.send('trampa', { cartas: 'todas' });
    await waitUntil(() => (errorCodes(ana).length === 2 ? true : undefined));
    expect(errorCodes(ana)).toEqual(['INVALID_MESSAGE', 'INVALID_MESSAGE']);
  });

  it('una segunda conexión del mismo usuario sustituye a la primera sin perder el asiento', async () => {
    const ana = await TestClient.create(bench, as('ana', { mode: '2v2' }));
    ana.send(CLIENT_MESSAGES.takeSeat, { seat: 2 });
    await ana.waitFor(SERVER_MESSAGES.you, (m: { seat: number | null }) => m.seat === 2);
    const again = await TestClient.join(bench, ana.roomId, as('ana'));
    expect(await again.waitFor(SERVER_MESSAGES.you)).toMatchObject({ seat: 2 });
    await waitUntil(() => (serverRoom(again).clients.length === 1 ? true : undefined));
    expect(serverRoom(again).metadata.seatsTaken).toBe(1);
  });
});

describe('espectadores', () => {
  it(`admite ${String(MAX_SPECTATORS)} y rechaza al siguiente; no pueden sentarse`, async () => {
    const ana = await TestClient.create(bench, as('ana', { mode: 'solo' }));
    const spectators: TestClient[] = [];
    for (let i = 0; i < MAX_SPECTATORS; i++) {
      spectators.push(
        await TestClient.join(bench, ana.roomId, as(`s${String(i)}`, { role: 'spectator' })),
      );
    }
    await expect(
      TestClient.join(bench, ana.roomId, as('extra', { role: 'spectator' })),
    ).rejects.toThrow('SPECTATORS_FULL');
    await waitUntil(() => (ana.state.spectators === MAX_SPECTATORS ? true : undefined));
    expect(serverRoom(ana).metadata.spectators).toBe(MAX_SPECTATORS);

    const first = spectators[0];
    expect(await first?.waitFor(SERVER_MESSAGES.you)).toEqual({
      role: 'spectator',
      seat: null,
      code: null,
    });
    first?.send(CLIENT_MESSAGES.takeSeat, { seat: 1 });
    if (first) await waitForError(first, 'NOT_A_PLAYER');
    await first?.leave();
    await waitUntil(() => (ana.state.spectators === MAX_SPECTATORS - 1 ? true : undefined));
  });
});

describe('sala privada', () => {
  async function privateRoom(): Promise<{ ana: TestClient; code: string }> {
    const ana = await TestClient.create(bench, as('ana', { mode: '2v2', visibility: 'private' }));
    const you = await ana.waitFor<{ code: string | null }>(SERVER_MESSAGES.you);
    return { ana, code: you.code ?? '' };
  }

  it('el creador recibe el código; sin él o con uno erróneo no se entra', async () => {
    const { ana, code } = await privateRoom();
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(serverRoom(ana).metadata).toMatchObject({ visibility: 'private', hasCode: true });
    await expect(TestClient.join(bench, ana.roomId, as('bea'))).rejects.toThrow('WRONG_CODE');
    const wrong = code === 'AAAAAA' ? 'BBBBBB' : 'AAAAAA';
    await expect(TestClient.join(bench, ana.roomId, as('bea', { code: wrong }))).rejects.toThrow(
      'WRONG_CODE',
    );
    const bea = await TestClient.join(bench, ana.roomId, as('bea', { code: code.toLowerCase() }));
    expect(await bea.waitFor(SERVER_MESSAGES.you)).toMatchObject({ code });
    const spectator = await TestClient.join(
      bench,
      ana.roomId,
      as('eva', { role: 'spectator', code }),
    );
    expect(await spectator.waitFor(SERVER_MESSAGES.you)).toMatchObject({ role: 'spectator' });
  });

  it(`tras ${String(PRIVATE_CODE_MAX_FAILS.max)} fallos se bloquea aunque el código sea bueno`, async () => {
    const { ana, code } = await privateRoom();
    for (let i = 0; i < PRIVATE_CODE_MAX_FAILS.max; i++) {
      await expect(
        TestClient.join(
          bench,
          ana.roomId,
          as(`x${String(i)}`, { code: 'AAAAAA' === code ? 'BBBBBB' : 'AAAAAA' }),
        ),
      ).rejects.toThrow('WRONG_CODE');
    }
    await expect(TestClient.join(bench, ana.roomId, as('bea', { code }))).rejects.toThrow(
      'TOO_MANY_ATTEMPTS',
    );
  });
});
