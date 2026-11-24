// Banco de pruebas de integración (ADR-0004 §8): un servidor real con clientes reales del SDK.
// Cada archivo de test corre en su propio proceso de Vitest; el puerto sale del id del proceso
// para que varios archivos no choquen.
import { randomUUID } from 'node:crypto';

import { createSeededRng, type Action, type Rng } from '@31mus/engine';
import {
  CLIENT_MESSAGES,
  MUS_ROOM_NAME,
  SERVER_MESSAGES,
  type GameViewMessage,
  type YouMessage,
} from '@31mus/shared';
import { ColyseusSDK, type Room as ClientRoom } from '@colyseus/sdk';
import { ColyseusTestServer } from '@colyseus/testing';

import { devIdentityVerifier } from '../identity/dev-identity.js';
import { silentLogger } from '../infra/logger.js';
import { MemoryMatchLogStore } from '../match-log/memory-store.js';
import { createGameServer, type GameServerOptions } from '../server.js';

const BASE_PORT = 25_680;

export interface TestBench {
  readonly colyseus: ColyseusTestServer;
  readonly port: number;
  readonly sdk: ColyseusSDK;
  shutdown(): Promise<void>;
}

export async function startTestServer(
  overrides: Partial<GameServerOptions> = {},
): Promise<TestBench> {
  const port = BASE_PORT + Number(process.env.VITEST_POOL_ID ?? '0');
  const server = createGameServer({
    production: false,
    identity: devIdentityVerifier,
    rng: createSeededRng(1),
    logger: silentLogger,
    matchLog: new MemoryMatchLogStore(),
    ...overrides,
  });
  await server.listen(port, '127.0.0.1');
  const colyseus = new ColyseusTestServer(server);
  return {
    colyseus,
    port,
    sdk: new ColyseusSDK(`ws://127.0.0.1:${String(port)}`),
    shutdown: () => colyseus.shutdown(),
  };
}

/** Estado público de la sala tal como lo ve un cliente (`rooms/room-state.ts`). */
export interface PublicSeat {
  readonly kind: string;
  readonly nickname: string;
  readonly personaId: string;
  readonly connected: boolean;
}

export interface PublicRoomState {
  readonly mode: string;
  readonly visibility: string;
  readonly status: string;
  readonly spectators: number;
  readonly seats: { map<U>(fn: (seat: PublicSeat) => U): U[] };
}

/** Cliente de prueba que guarda todo lo que recibe, en orden. */
export class TestClient {
  readonly received: { type: string; payload: unknown }[] = [];
  private autoRng: Rng | null = null;
  /** Código de cierre si la sala echó o cerró la conexión. */
  leftWith: number | null = null;

  private constructor(readonly room: ClientRoom) {
    room.onLeave((code) => {
      this.leftWith = code;
    });
    room.onMessage('*', (type, payload) => {
      this.received.push({ type: String(type), payload });
      if (type === SERVER_MESSAGES.view) this.maybeAutoPlay(payload as GameViewMessage);
    });
  }

  /** Juega solo: ante cada vista con acciones legales, envía una al azar. */
  autoPlay(rng: Rng): void {
    this.autoRng = rng;
    const view = this.messages<GameViewMessage>(SERVER_MESSAGES.view).at(-1);
    if (view !== undefined) this.maybeAutoPlay(view);
  }

  stopAutoPlay(): void {
    this.autoRng = null;
  }

  /** Envía una acción de juego con un `actionId` nuevo. */
  act(action: Action, version: number): string {
    const actionId = randomUUID();
    this.send(CLIENT_MESSAGES.action, { actionId, version, action });
    return actionId;
  }

  /** Última vista de la partida recibida. */
  view(): GameViewMessage | undefined {
    return this.messages<GameViewMessage>(SERVER_MESSAGES.view).at(-1);
  }

  private maybeAutoPlay(message: GameViewMessage): void {
    if (this.autoRng === null || message.legal.length === 0) return;
    const action = message.legal[this.autoRng.nextInt(message.legal.length)];
    if (action !== undefined) this.act(action, message.version);
  }

  static async create(bench: TestBench, options: Record<string, unknown>): Promise<TestClient> {
    const room = await bench.sdk.create(MUS_ROOM_NAME, options);
    return new TestClient(room);
  }

  static async join(
    bench: TestBench,
    roomId: string,
    options: Record<string, unknown>,
  ): Promise<TestClient> {
    const room = await bench.sdk.joinById(roomId, options);
    return new TestClient(room);
  }

  get state(): PublicRoomState {
    return this.room.state as PublicRoomState;
  }

  get roomId(): string {
    return this.room.roomId;
  }

  send(type: string, payload: unknown): void {
    this.room.send(type, payload);
  }

  messages<T>(type: string): T[] {
    return this.received.filter((m) => m.type === type).map((m) => m.payload as T);
  }

  /** Último `room:you` recibido. */
  you(): YouMessage | undefined {
    return this.messages<YouMessage>(SERVER_MESSAGES.you).at(-1);
  }

  /** Espera a que llegue un mensaje de `type` que cumpla `predicate` (también si ya llegó). */
  async waitFor<T>(
    type: string,
    predicate: (payload: T) => boolean = () => true,
    timeoutMs = 2_000,
  ): Promise<T> {
    return waitUntil(() => this.messages<T>(type).find(predicate), timeoutMs, `mensaje ${type}`);
  }

  leave(): Promise<number> {
    return this.room.leave();
  }

  /** Corta la conexión sin despedirse (como una caída de red) y sin reconexión automática. */
  async drop(): Promise<void> {
    this.room.reconnection.enabled = false;
    await this.room.leave(false);
  }

  /** Vuelve a la misma sesión con el token de reconexión de un cliente caído. */
  static async reconnect(bench: TestBench, previous: TestClient): Promise<TestClient> {
    const room = await bench.sdk.reconnect(previous.room.reconnectionToken);
    return new TestClient(room);
  }
}

/** Espera hasta que `probe` devuelva algo distinto de `undefined`. */
export async function waitUntil<T>(
  probe: () => T | undefined,
  timeoutMs = 2_000,
  what = 'condición',
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`Tiempo agotado esperando ${what}.`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Identidad de desarrollo para las opciones de unión. */
export function as(userId: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { userId, nickname: userId, ...extra };
}
