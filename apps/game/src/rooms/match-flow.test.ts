// Partida por la red con clientes reales (CLAUDE.md §7, ADR-0004 §8): tiempos acortados, mismo
// código que en producción.
import { createSeededRng, type Seat } from '@31mus/engine';
import {
  CLIENT_MESSAGES,
  SERVER_MESSAGES,
  type ActionResultMessage,
  type GameEventsMessage,
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

const TIMING: TableTiming = {
  turnMs: 400,
  botDelayMinMs: 1,
  botDelayMaxMs: 3,
  handPauseMs: 5,
  emptyRoomMs: 300,
  finishedLingerMs: 100,
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

function finished(client: TestClient): true | undefined {
  const winner = client.view()?.view.matchWinner ?? null;
  return winner === null ? undefined : true;
}

describe('partida completa', () => {
  it('solo: un jugador juega hasta el final; la sala se cierra tras ver el resultado', async () => {
    const ana = await TestClient.create(bench, as('ana', { mode: 'solo' }));
    ana.autoPlay(createSeededRng(42));
    await waitUntil(() => finished(ana), 60_000, 'el fin de la partida');
    expect(ana.state.status).toBe('finished');
    const events = ana.messages<GameEventsMessage>(SERVER_MESSAGES.events).flatMap((m) => m.events);
    expect(events.filter((e) => e.type === 'matchWon')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'handStarted').length).toBeGreaterThan(1);
    const results = ana.messages<ActionResultMessage>(SERVER_MESSAGES.actionResult);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.ok)).toBe(true);
    const versions = ana.messages<{ version: number }>(SERVER_MESSAGES.view).map((v) => v.version);
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);
    await waitUntil(() => ana.leftWith ?? undefined, 2_000, 'el cierre de la sala');
  }, 90_000);

  it('si el jugador no hace nada, juega el temporizador por él y la partida avanza', async () => {
    const ana = await TestClient.create(bench, as('ana', { mode: 'solo' }));
    const you = await ana.waitFor<{ seat: Seat }>(SERVER_MESSAGES.you);
    await waitUntil(
      () =>
        ana
          .messages<GameEventsMessage>(SERVER_MESSAGES.events)
          .flatMap((m) => m.events)
          .some((e) => 'seat' in e && e.seat === you.seat && e.type !== 'cardsDealt')
          ? true
          : undefined,
      5_000,
      'una acción por tiempo agotado',
    );
  });
});

describe('acciones por la red', () => {
  it('rechaza versión vieja, mensajes mal formados y acciones de espectadores', async () => {
    const ana = await TestClient.create(bench, as('ana', { mode: 'solo' }));
    const first = await ana.waitFor(SERVER_MESSAGES.view);
    expect(first).toBeDefined();
    const staleId = ana.act({ type: 'mus' }, 999);
    await ana.waitFor<ActionResultMessage>(
      SERVER_MESSAGES.actionResult,
      (r) => r.actionId === staleId,
    );
    expect(ana.messages<ActionResultMessage>(SERVER_MESSAGES.actionResult)[0]).toMatchObject({
      ok: false,
      code: 'STALE_VERSION',
    });
    ana.send(CLIENT_MESSAGES.action, {
      actionId: 'no-es-uuid',
      version: 1,
      action: { type: 'mus' },
    });
    await ana.waitFor<RoomErrorMessage>(SERVER_MESSAGES.error, (e) => e.code === 'INVALID_MESSAGE');

    const eva = await TestClient.join(bench, ana.roomId, as('eva', { role: 'spectator' }));
    const spectatorView = await eva.waitFor(SERVER_MESSAGES.view);
    expect(spectatorView).toMatchObject({ legal: [], deadline: null, view: { ownCards: null } });
    eva.act({ type: 'mus' }, 1);
    await eva.waitFor<RoomErrorMessage>(SERVER_MESSAGES.error, (e) => e.code === 'NOT_A_PLAYER');
  });

  it('en el lobby una acción de juego responde MATCH_NOT_RUNNING', async () => {
    const ana = await TestClient.create(bench, as('ana', { mode: '2v2' }));
    ana.send(CLIENT_MESSAGES.takeSeat, { seat: 0 });
    await ana.waitFor<{ seat: Seat | null }>(SERVER_MESSAGES.you, (m) => m.seat === 0);
    const id = ana.act({ type: 'mus' }, 0);
    expect(
      await ana.waitFor<ActionResultMessage>(
        SERVER_MESSAGES.actionResult,
        (r) => r.actionId === id,
      ),
    ).toMatchObject({ ok: false, code: 'MATCH_NOT_RUNNING' });
  });
});

describe('abandono y vuelta (D7, D20)', () => {
  async function duo(): Promise<[TestClient, TestClient]> {
    const ana = await TestClient.create(bench, as('ana', { mode: 'duo_vs_bots' }));
    const bea = await TestClient.join(bench, ana.roomId, as('bea'));
    ana.send(CLIENT_MESSAGES.takeSeat, { seat: 0 });
    bea.send(CLIENT_MESSAGES.takeSeat, { seat: 2 });
    await waitUntil(() => (ana.state.status === 'playing' ? true : undefined));
    return [ana, bea];
  }

  it('quien se va lo sustituye un bot; al volver recupera su asiento y su vista', async () => {
    const [ana, bea] = await duo();
    await bea.leave();
    await waitUntil(() =>
      ana.state.seats.map((s) => s.connected)[2] === false ? true : undefined,
    );
    const before = ana.view()?.version ?? 0;
    ana.autoPlay(createSeededRng(1));
    await waitUntil(() => ((ana.view()?.version ?? 0) > before + 10 ? true : undefined), 5_000);

    const back = await TestClient.join(bench, ana.roomId, as('bea'));
    expect(await back.waitFor(SERVER_MESSAGES.you)).toMatchObject({ role: 'player', seat: 2 });
    const view = await back.waitFor<{ view: { ownCards: unknown } }>(SERVER_MESSAGES.view);
    expect(view.view.ownCards).not.toBeNull();
    await waitUntil(() => (ana.state.seats.map((s) => s.connected)[2] ? true : undefined));
  });

  it('sin humanos la partida se pausa; si vuelve uno, sigue', async () => {
    const [ana, bea] = await duo();
    const eva = await TestClient.join(bench, ana.roomId, as('eva', { role: 'spectator' }));
    await ana.leave();
    await bea.leave();
    await waitUntil(() => (eva.state.status === 'paused' ? true : undefined));
    const back = await TestClient.join(bench, eva.roomId, as('ana'));
    await waitUntil(() => (eva.state.status === 'playing' ? true : undefined));
    const view = await back.waitFor<{ view: { ownCards: unknown } }>(SERVER_MESSAGES.view);
    expect(view.view.ownCards).not.toBeNull();
  });

  it('si nadie vuelve en el plazo, la mesa se cierra como abandonada', async () => {
    const [ana, bea] = await duo();
    const eva = await TestClient.join(bench, ana.roomId, as('eva', { role: 'spectator' }));
    await ana.leave();
    await bea.leave();
    await waitUntil(() => eva.leftWith ?? undefined, 3_000, 'el cierre por abandono');
  });
});
