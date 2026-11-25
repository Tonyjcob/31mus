// Test de fuga de información (CLAUDE.md §9, ADR-0004 §8): partidas completas por la red con
// jugadores y espectadores, también con caídas y reconexiones a mitad de mano. Se graba todo lo que
// recibe cada cliente y ninguna carta ajena puede aparecer antes de que se enseñen las manos.
import { createSeededRng, type Seat } from '@31mus/engine';
import { CLIENT_MESSAGES, SERVER_MESSAGES } from '@31mus/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MemoryMatchLogStore, type StoredMatch } from '../match-log/memory-store.js';
import type { TableTiming } from '../table/table-session.js';
import { cardsHeld, cardsIn, findLeaks } from '../testing/leak-check.js';
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
  emptyRoomMs: 5_000,
  finishedLingerMs: 300,
};
const MATCH_TIMEOUT_MS = 60_000;

let bench: TestBench;
const matchLog = new MemoryMatchLogStore();

beforeAll(async () => {
  bench = await startTestServer({ timing: TIMING, matchLog });
});

afterEach(async () => {
  await bench.colyseus.cleanup();
});

afterAll(async () => {
  await bench.shutdown();
});

async function finishedMatch(roomId: string): Promise<StoredMatch> {
  return waitUntil(
    () => matchLog.all().find((m) => m.meta.roomId === roomId && m.result !== null),
    MATCH_TIMEOUT_MS,
    'el final de la partida en el log',
  );
}

/** Ninguna fuga y, para los jugadores, que de verdad se revisaron cartas propias. */
function expectNoLeaks(client: TestClient, viewer: Seat | 'spectator', match: StoredMatch): void {
  const report = findLeaks(client.received, viewer, cardsHeld(match));
  expect(report.leaks).toEqual([]);
  if (viewer !== 'spectator') expect(report.ownCardsSeen).toBeGreaterThan(0);
  expect(cardsIn(client.room.state)).toEqual([]);
}

describe('fuga de información', () => {
  it.each([1, 2])(
    'solo con espectador, partida %i completa',
    async (seed) => {
      const ana = await TestClient.create(bench, as('ana', { mode: 'solo' }));
      const eva = await TestClient.join(bench, ana.roomId, as('eva', { role: 'spectator' }));
      ana.autoPlay(createSeededRng(seed));
      const match = await finishedMatch(ana.roomId);
      expect(match.result?.end).toBe('won');
      expectNoLeaks(ana, 0, match);
      expectNoLeaks(eva, 'spectator', match);
    },
    90_000,
  );

  it('dos humanos y espectadores, con caídas y vueltas a mitad de mano', async () => {
    const ana = await TestClient.create(bench, as('ana', { mode: 'duo_vs_bots' }));
    const bea = await TestClient.join(bench, ana.roomId, as('bea'));
    const eva = await TestClient.join(bench, ana.roomId, as('eva', { role: 'spectator' }));
    ana.send(CLIENT_MESSAGES.takeSeat, { seat: 0 });
    bea.send(CLIENT_MESSAGES.takeSeat, { seat: 2 });
    ana.autoPlay(createSeededRng(3));
    bea.autoPlay(createSeededRng(4));
    const version = (): number => ana.view()?.version ?? 0;
    await waitUntil(() => (version() > 15 ? true : undefined), 5_000);

    // Bea cae a mitad de mano (juega el bot por ella) y vuelve con la misma sesión.
    await bea.drop();
    const dropped = version();
    await waitUntil(() => (version() > dropped + 10 ? true : undefined), 5_000);
    const beaBack = await TestClient.reconnect(bench, bea);
    beaBack.autoPlay(createSeededRng(5));

    // Eva (espectadora) se va y entra otra vez con una sesión nueva a mitad de partida.
    await eva.leave();
    const evaBack = await TestClient.join(bench, ana.roomId, as('eva', { role: 'spectator' }));
    await evaBack.waitFor(SERVER_MESSAGES.view);

    const match = await finishedMatch(ana.roomId);
    expect(match.result?.end).toBe('won');
    expectNoLeaks(ana, 0, match);
    expectNoLeaks(bea, 2, match);
    expectNoLeaks(beaBack, 2, match);
    expectNoLeaks(eva, 'spectator', match);
    expectNoLeaks(evaBack, 'spectator', match);
  }, 90_000);
});

describe('el detector de fugas', () => {
  it('encuentra una carta ajena en cualquier sitio del mensaje antes del final de la mano', () => {
    const match: StoredMatch = {
      meta: { matchId: 'm', roomId: 'r', mode: 'solo', startedAt: 0, seats: [] },
      result: null,
      hands: [
        {
          matchId: 'm',
          number: 1,
          gameNumber: 1,
          mano: 0,
          dealt: [
            ['oros-1', 'oros-4', 'oros-5', 'oros-6'],
            ['copas-1', 'copas-4', 'copas-5', 'copas-6'],
            ['espadas-1', 'espadas-4', 'espadas-5', 'espadas-6'],
            ['bastos-1', 'bastos-4', 'bastos-5', 'bastos-6'],
          ],
          startedAt: 0,
          endedAt: 0,
          before: { scores: [0, 0], gamesWon: [0, 0] },
          after: { scores: [0, 0], gamesWon: [0, 0] },
          steps: [],
          complete: true,
        },
      ],
    };
    const held = cardsHeld(match);
    const handStarted = {
      type: SERVER_MESSAGES.events,
      payload: { events: [{ type: 'handStarted', handNumber: 1, gameNumber: 1, mano: 0 }] },
    };
    const ownCard = { type: SERVER_MESSAGES.chat, payload: { text: 'tengo oros-1' } };
    const leak = { type: 'otro', payload: { deep: { nested: ['copas-5'] } } };
    const revealed = {
      type: SERVER_MESSAGES.events,
      payload: { events: [{ type: 'handRevealed', hands: match.hands[0]?.dealt }] },
    };

    expect(findLeaks([handStarted, ownCard, leak], 0, held)).toEqual({
      leaks: ['otro (mano 1): copas-5'],
      ownCardsSeen: 1,
    });
    expect(findLeaks([handStarted, ownCard], 'spectator', held).leaks).toHaveLength(1);
    expect(findLeaks([handStarted, revealed, leak], 0, held).leaks).toEqual([]);
  });
});
