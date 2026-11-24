// Log de partidas (ADR-0004 §4): manos con eventos, hora y autor; final con ganador o abandono;
// los fallos de escritura no paran nada; el adaptador de ficheros escribe JSON Lines.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { NEUTRAL_PERSONA } from '@31mus/bots';
import { createSeededRng } from '@31mus/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { silentLogger, type Logger } from '../infra/logger.js';
import { MatchController } from '../table/match-controller.js';
import { FakeScheduler } from '../testing/fake-scheduler.js';
import { FileMatchLogStore } from './file-store.js';
import type { HandRecord, MatchLogStore, MatchMeta, MatchResult } from './match-log.js';
import { MatchRecorder } from './match-recorder.js';
import { MemoryMatchLogStore } from './memory-store.js';

const META: MatchMeta = {
  matchId: 'match-1',
  roomId: 'room-1',
  mode: 'solo',
  startedAt: 0,
  seats: [
    { seat: 0, kind: 'human', userId: 'ana', nickname: 'ana' },
    { seat: 1, kind: 'bot', personaId: 'abuelo' },
    { seat: 2, kind: 'bot', personaId: 'faraona' },
    { seat: 3, kind: 'bot', personaId: 'pollo' },
  ],
};

/** Partida de 4 bots con reloj falso, registrada con `store`. */
function play(store: MatchLogStore, logger: Logger = silentLogger) {
  const clock = new FakeScheduler(1_000_000);
  const recorder = new MatchRecorder(META, { store, logger, scheduler: clock });
  const controller = new MatchController({
    scheduler: clock,
    rng: createSeededRng(11),
    logger: silentLogger,
    timing: { turnMs: 30_000, botDelayMinMs: 1_000, botDelayMaxMs: 3_000, handPauseMs: 8_000 },
    control: () => ({ kind: 'bot', persona: NEUTRAL_PERSONA }),
    publish: () => undefined,
    record: (step) => {
      recorder.step(step);
    },
  });
  controller.start();
  return { clock, recorder, controller };
}

describe('MatchRecorder', () => {
  it('guarda cada mano completa con sus pasos y el resultado de la partida', async () => {
    const store = new MemoryMatchLogStore();
    const { clock, recorder, controller } = play(store);
    while (controller.status !== 'finished') clock.advance(10_000);
    await recorder.flushed();

    const match = store.get('match-1');
    expect(match?.meta).toEqual(META);
    const hands = match?.hands ?? [];
    expect(hands.length).toBeGreaterThan(1);
    expect(hands.map((h) => h.number)).toEqual(hands.map((_, i) => i + 1));
    for (const hand of hands) {
      expect(hand.complete).toBe(true);
      expect(hand.dealt.every((cards) => cards.length === 4)).toBe(true);
      expect(hand.steps[0]?.actor).toEqual({ by: 'system' });
      expect(hand.steps.slice(1).every((s) => s.actor.by === 'bot' && s.action !== null)).toBe(
        true,
      );
      expect(hand.endedAt).toBeGreaterThanOrEqual(hand.startedAt);
    }
    // La segunda mano empieza tras la pausa de 8 s (D19).
    const [first, second] = hands;
    expect((second?.startedAt ?? 0) - (first?.endedAt ?? 0)).toBe(8_000);
    expect(match?.result).toMatchObject({ end: 'won', hands: hands.length });
    expect(match?.result?.winner).not.toBeNull();
    expect(Math.max(...(match?.result?.gamesWon ?? []))).toBe(2);
  });

  it('al abandonar guarda la mano a medias como incompleta y no escribe nada más', async () => {
    const store = new MemoryMatchLogStore();
    const { clock, recorder } = play(store);
    clock.advance(5_000);
    recorder.finish('abandoned');
    recorder.finish('won');
    clock.advance(60_000);
    await recorder.flushed();

    const match = store.get('match-1');
    expect(match?.hands.map((h) => h.complete)).toEqual([false]);
    expect(match?.result).toMatchObject({ end: 'abandoned', winner: null, hands: 1 });
  });

  it('un fallo al escribir se registra y no impide lo siguiente', async () => {
    const memory = new MemoryMatchLogStore();
    const failing: MatchLogStore = {
      startMatch: (meta) => memory.startMatch(meta),
      appendHand: () => Promise.reject(new Error('disco lleno')),
      finishMatch: (result: MatchResult) => memory.finishMatch(result),
    };
    const error = vi.fn();
    const logger = { ...silentLogger, error } as unknown as Logger;
    const { clock, recorder, controller } = play(failing, logger);
    while (controller.status !== 'finished') clock.advance(10_000);
    await recorder.flushed();

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ matchId: 'match-1' }),
      'no se pudo escribir el log',
    );
    expect(memory.get('match-1')?.result?.end).toBe('won');
  });
});

describe('FileMatchLogStore', () => {
  let directory: string | null = null;

  afterEach(async () => {
    if (directory !== null) await rm(directory, { recursive: true, force: true });
    directory = null;
  });

  it('escribe una línea JSON por registro en el fichero de la partida', async () => {
    directory = join(await mkdtemp(join(tmpdir(), '31mus-log-')), 'match-logs');
    const store = new FileMatchLogStore(directory);
    const { clock, recorder, controller } = play(store);
    while (controller.status !== 'finished') clock.advance(10_000);
    await recorder.flushed();

    const text = await readFile(store.pathOf('match-1'), 'utf8');
    const lines = text
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line) as { type: string });
    expect(lines[0]).toMatchObject({ type: 'start', roomId: 'room-1' });
    expect(lines.at(-1)).toMatchObject({ type: 'finish', end: 'won' });
    const hands = lines.filter((l): l is HandRecord & { type: string } => l.type === 'hand');
    expect(hands.length).toBe(lines.length - 2);
    expect(hands[0]?.steps.length).toBeGreaterThan(1);
  });

  it('no acepta identificadores que no sirven como nombre de fichero', () => {
    const store = new FileMatchLogStore('logs');
    expect(() => store.pathOf('../fuera')).toThrow();
    expect(store.pathOf('abc-123')).toBe(join('logs', 'abc-123.jsonl'));
  });
});
