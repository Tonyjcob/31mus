// MatchController con reloj falso (ADR-0004 §8): turnos, bots, manos y pausa sin esperar de verdad.
import { NEUTRAL_PERSONA } from '@31mus/bots';
import {
  SEATS,
  createSeededRng,
  getLegalActions,
  pendingSeats,
  type Action,
  type Seat,
} from '@31mus/engine';
import { ACTION_ID_MEMORY } from '@31mus/shared';
import { describe, expect, it, vi } from 'vitest';

import type { Logger } from '../infra/logger.js';
import { silentLogger } from '../infra/logger.js';
import { FakeScheduler } from '../testing/fake-scheduler.js';
import {
  MatchController,
  type MatchTiming,
  type SeatControl,
  type StepRecord,
} from './match-controller.js';
import type { MatchSnapshot } from './outbound.js';

const TIMING: MatchTiming = {
  turnMs: 30_000,
  botDelayMinMs: 1_000,
  botDelayMaxMs: 3_000,
  handPauseMs: 8_000,
};
const BOT: SeatControl = { kind: 'bot', persona: NEUTRAL_PERSONA };
const HUMAN: SeatControl = { kind: 'human' };

let ids = 0;
function actionId(): string {
  ids++;
  return `00000000-0000-4000-8000-${String(ids).padStart(12, '0')}`;
}

function harness(humans: readonly Seat[], seed = 3, logger: Logger = silentLogger) {
  const clock = new FakeScheduler(1_000_000);
  const controls = new Map<Seat, SeatControl>(
    SEATS.map((s) => [s, humans.includes(s) ? HUMAN : BOT]),
  );
  const published: MatchSnapshot[] = [];
  const records: StepRecord[] = [];
  const onFinished = vi.fn();
  const controller = new MatchController({
    scheduler: clock,
    rng: createSeededRng(seed),
    logger,
    timing: TIMING,
    control: (seat) => controls.get(seat) ?? BOT,
    publish: (snapshot) => published.push(snapshot),
    record: (step) => records.push(step),
    onFinished,
  });
  const last = (): MatchSnapshot => {
    const snapshot = published.at(-1);
    if (snapshot === undefined) throw new Error('nada publicado');
    return snapshot;
  };
  const act = (seat: Seat, action: Action, version = last().version) =>
    controller.act(seat, { actionId: actionId(), version, action });
  return { clock, controls, published, records, onFinished, controller, last, act };
}

describe('inicio', () => {
  it('reparte, publica la versión 1 y arma el turno del pendiente con 30 s', () => {
    const h = harness([0, 1, 2, 3]);
    h.controller.start({ firstMano: 2 });
    expect(h.controller.status).toBe('playing');
    const snapshot = h.last();
    expect(snapshot.version).toBe(1);
    expect(snapshot.running).toBe(true);
    expect(pendingSeats(snapshot.state)).toEqual([2]);
    expect(snapshot.deadlines).toEqual([null, null, 1_030_000, null]);
    expect(h.records[0]?.actor).toEqual({ by: 'system' });
    h.controller.start();
    expect(h.published).toHaveLength(1);
  });

  it('sin partida no hay instantánea', () => {
    expect(harness([0]).controller.snapshot()).toBeNull();
  });
});

describe('acciones de un humano', () => {
  it('aplica una acción legal y sube la versión', () => {
    const h = harness([0, 1, 2, 3]);
    h.controller.start({ firstMano: 0 });
    expect(h.act(0, { type: 'mus' })).toMatchObject({ ok: true });
    expect(h.last().version).toBe(2);
    expect(h.last().events).toContainEqual({ type: 'musSpoken', seat: 0, choice: 'mus' });
    expect(h.records.at(-1)?.actor).toEqual({ seat: 0, by: 'human' });
  });

  it('rechaza versión vieja, fuera de turno y acción ilegal', () => {
    const h = harness([0, 1, 2, 3]);
    h.controller.start({ firstMano: 0 });
    expect(h.act(0, { type: 'mus' }, 0)).toMatchObject({ ok: false, code: 'STALE_VERSION' });
    expect(h.act(1, { type: 'mus' })).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' });
    expect(h.act(0, { type: 'quiero' })).toMatchObject({ ok: false, code: 'ILLEGAL_ACTION' });
    expect(h.last().version).toBe(1);
  });

  it('un actionId repetido devuelve la misma respuesta y no aplica nada (idempotencia)', () => {
    const h = harness([0, 1, 2, 3]);
    h.controller.start({ firstMano: 0 });
    const message = { actionId: actionId(), version: 1, action: { type: 'mus' } as const };
    const first = h.controller.act(0, message);
    expect(first.ok).toBe(true);
    expect(h.controller.act(0, message)).toBe(first);
    expect(h.last().version).toBe(2);
  });

  it(`recuerda como mucho ${String(ACTION_ID_MEMORY)} actionId por asiento`, () => {
    const h = harness([0, 1, 2, 3]);
    h.controller.start({ firstMano: 0 });
    const firstId = actionId();
    h.controller.act(1, { actionId: firstId, version: 1, action: { type: 'mus' } });
    for (let i = 0; i < ACTION_ID_MEMORY; i++) h.act(1, { type: 'mus' });
    const again = h.controller.act(1, { actionId: firstId, version: 0, action: { type: 'mus' } });
    expect(again).toMatchObject({ ok: false, code: 'STALE_VERSION' });
  });
});

describe('tiempo de turno', () => {
  it('al vencer los 30 s aplica la acción por tiempo agotado del motor', () => {
    const h = harness([0, 1, 2, 3]);
    h.controller.start({ firstMano: 0 });
    h.clock.advance(TIMING.turnMs - 1);
    expect(h.last().version).toBe(1);
    h.clock.advance(1);
    expect(h.records.at(-1)).toMatchObject({
      actor: { seat: 0, by: 'timeout' },
      action: { type: 'corto' },
    });
    // Tras cortar, la grande empieza por la mano (D11): mismo asiento, plazo nuevo y completo.
    expect(pendingSeats(h.last().state)).toEqual([0]);
    expect(h.last().deadlines[0]).toBe(1_000_000 + 2 * TIMING.turnMs);
  });

  it('en el descarte simultáneo cada asiento conserva su plazo cuando descarta otro', () => {
    const h = harness([0, 1, 2, 3]);
    h.controller.start({ firstMano: 0 });
    for (const seat of [0, 1, 2, 3] as const) h.act(seat, { type: 'mus' });
    const discard = h.last();
    expect(discard.state.hand.phase.kind).toBe('discard');
    const deadlines = discard.deadlines;
    h.clock.advance(5_000);
    const legal = getLegalActions(discard.state, 2)[0];
    if (legal === undefined) throw new Error('sin descarte legal');
    expect(h.act(2, legal)).toMatchObject({ ok: true });
    expect(h.last().deadlines).toEqual([deadlines[0], deadlines[1], null, deadlines[3]]);
  });
});

describe('bots', () => {
  it('actúan entre 1 y 3 s después de su turno', () => {
    for (let seed = 0; seed < 20; seed++) {
      const h = harness([], seed);
      h.controller.start({ firstMano: 0 });
      h.clock.advance(TIMING.botDelayMinMs - 1);
      expect(h.last().version).toBe(1);
      h.clock.advance(TIMING.botDelayMaxMs - TIMING.botDelayMinMs + 1);
      expect(h.last().version).toBeGreaterThan(1);
      expect(h.records[1]?.actor).toEqual({ seat: 0, by: 'bot' });
    }
  });

  it('cuatro bots juegan una partida completa: pausa de 8 s entre manos y fin', () => {
    const h = harness([], 11);
    h.controller.start();
    for (let guard = 0; h.controller.status === 'playing' && guard < 100_000; guard++) {
      h.clock.advance(TIMING.botDelayMaxMs);
    }
    // Cada mano nueva se reparte exactamente 8 s después del fin de la anterior (D19).
    const dealt = h.records.flatMap((record, i) =>
      i > 0 && record.events[0]?.type === 'handStarted' ? [i] : [],
    );
    expect(dealt.length).toBeGreaterThan(1);
    for (const i of dealt) {
      const previous = h.records[i - 1];
      expect(previous?.state.hand.phase.kind).toBe('handOver');
      expect(h.records[i]?.at).toBe((previous?.at ?? 0) + TIMING.handPauseMs);
    }
    expect(h.controller.status).toBe('finished');
    expect(h.onFinished).toHaveBeenCalledWith(h.last().state.matchWinner);
    expect(h.last().running).toBe(false);
    expect(h.last().events).toContainEqual(expect.objectContaining({ type: 'matchWon' }));
    expect(h.clock.pending()).toBe(0);
    expect(h.act(0, { type: 'mus' })).toMatchObject({ ok: false, code: 'MATCH_NOT_RUNNING' });
    const versions = h.published.map((s) => s.version);
    expect(versions).toEqual(versions.map((_, i) => i + 1));
  });

  it('si el humano se va en su turno, el bot juega por él; si vuelve, decide él', () => {
    const h = harness([0, 1, 2, 3]);
    h.controller.start({ firstMano: 0 });
    h.controls.set(0, BOT);
    h.controller.controlChanged(0);
    h.clock.advance(TIMING.botDelayMaxMs);
    expect(h.records.at(-1)?.actor).toEqual({ seat: 0, by: 'bot' });
    h.controls.set(0, HUMAN);
    h.controller.controlChanged(0);
    h.controller.controlChanged(1);
    h.clock.advance(TIMING.turnMs - 1);
    expect(h.records.at(-1)?.actor).toEqual({ seat: 0, by: 'bot' });
  });
});

describe('pausa (D20)', () => {
  it('sin humanos se para todo; al volver, turno nuevo completo', () => {
    const h = harness([0, 1, 2, 3]);
    h.controller.start({ firstMano: 0 });
    h.controller.pause();
    h.controller.pause();
    expect(h.controller.status).toBe('paused');
    expect(h.last().running).toBe(false);
    expect(h.clock.pending()).toBe(0);
    h.clock.advance(10 * TIMING.turnMs);
    expect(h.act(0, { type: 'mus' })).toMatchObject({ ok: false, code: 'MATCH_NOT_RUNNING' });
    h.controller.resume();
    h.controller.resume();
    expect(h.controller.status).toBe('playing');
    expect(h.last().deadlines[0]).toBe(h.clock.now() + TIMING.turnMs);
  });

  it('en pausa durante el fin de mano, al volver se reparte tras la pausa entre manos', () => {
    const h = harness([], 5);
    h.controller.start();
    while (h.last().state.hand.phase.kind !== 'handOver') h.clock.advance(TIMING.botDelayMaxMs);
    const hand = h.last().state.hand.number;
    h.controller.pause();
    h.clock.advance(TIMING.handPauseMs * 10);
    expect(h.last().state.hand.number).toBe(hand);
    h.controller.resume();
    h.clock.advance(TIMING.handPauseMs);
    expect(h.last().state.hand.number).toBe(hand + 1);
    h.controller.dispose();
    expect(h.clock.pending()).toBe(0);
  });
});

it('un error dentro de un temporizador se registra y no tumba nada', () => {
  const error = vi.fn();
  const logger = { ...silentLogger, error } as unknown as Logger;
  const h = harness([], 1, logger);
  h.controller.start({ firstMano: 0 });
  h.controls.set(0, { kind: 'bot', persona: { ...NEUTRAL_PERSONA, style: null as never } });
  h.controller.dispose();
  h.controller.resume();
  h.controller.pause();
  h.controller.resume();
  h.clock.advance(TIMING.botDelayMaxMs);
  expect(error).toHaveBeenCalledWith(
    expect.objectContaining({ what: 'turno de bot' }),
    'error en la partida',
  );
});
