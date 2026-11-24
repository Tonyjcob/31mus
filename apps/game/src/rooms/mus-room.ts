// Sala de mus en Colyseus (CLAUDE.md §7, ADR-0004). Adaptador fino: valida la entrada con Zod,
// delega en `Lobby` (y desde la tarea 4 en `MatchController`) y refleja el estado público.
import { BOT_PERSONAS } from '@31mus/bots';
import type { Rng, Seat } from '@31mus/engine';
import {
  CLIENT_MESSAGES,
  MAX_SPECTATORS,
  PRIVATE_CODE_MAX_FAILS,
  SERVER_MESSAGES,
  createRoomOptionsSchema,
  joinRoomOptionsSchema,
  takeSeatSchema,
  type BotChoice,
  type ClientRole,
  type CreateRoomOptions,
  type RoomErrorCode,
  type RoomErrorMessage,
  type RoomMode,
  type RoomStatus,
  type RoomVisibility,
  type YouMessage,
} from '@31mus/shared';
import {
  CloseCode,
  ErrorCode,
  Room,
  ServerError,
  type AuthContext,
  type Client,
  type RoomException,
} from '@colyseus/core';

import type { Identity, IdentityVerifier } from '../identity/identity.js';
import type { Logger } from '../infra/logger.js';
import { RateLimiter } from '../infra/rate-limiter.js';
import { clockScheduler, type Scheduler } from '../infra/scheduler.js';
import { codeMatches, generatePrivateCode } from '../private-code.js';
import { HUMANS_REQUIRED, Lobby, type SeatOccupant } from '../table/lobby.js';
import { MusRoomState, SeatState } from './room-state.js';

/** Dependencias que inyecta el servidor (nunca vienen del cliente). */
export interface MusRoomDeps {
  readonly identity: IdentityVerifier;
  readonly rng: Rng;
  readonly logger: Logger;
}

/** Lo que `onAuth` deja en `client.auth`. */
export interface ClientAuth {
  readonly identity: Identity;
  readonly role: ClientRole;
}

/** Metadatos de la sala para el listado (CLAUDE.md §7). */
export interface MusRoomMetadata {
  readonly mode: RoomMode;
  readonly visibility: RoomVisibility;
  readonly hasCode: boolean;
  readonly seatsTaken: number;
  readonly spectators: number;
  readonly status: RoomStatus;
}

type MusClient = Client<{ auth: ClientAuth }>;

interface Participant {
  readonly client: MusClient;
  readonly identity: Identity;
  readonly role: ClientRole;
}

/** Rechazo al unirse: el cliente recibe el código de error en el mensaje. */
function reject(code: RoomErrorCode): ServerError {
  return new ServerError(ErrorCode.AUTH_FAILED, code);
}

export abstract class MusRoom extends Room<{
  state: MusRoomState;
  metadata: MusRoomMetadata;
  client: MusClient;
}> {
  protected abstract readonly deps: MusRoomDeps;

  protected lobby!: Lobby;
  protected scheduler!: Scheduler;
  protected log!: Logger;
  private options!: CreateRoomOptions;
  private code: string | null = null;
  private creatorUserId = '';
  private codeFailures!: RateLimiter;
  private readonly participants = new Map<string, Participant>();
  /** Sesiones sustituidas por una conexión nueva del mismo usuario: su salida no cuenta. */
  private readonly superseded = new Set<string>();

  override async onCreate(rawOptions: unknown): Promise<void> {
    this.log = this.deps.logger.child({ roomId: this.roomId });
    this.scheduler = clockScheduler(this.clock);
    const parsed = createRoomOptionsSchema.safeParse(rawOptions);
    if (!parsed.success) throw reject('INVALID_OPTIONS');
    const chosen = [parsed.data.bots.partner, ...(parsed.data.bots.rivals ?? [])];
    if (chosen.some((id) => id !== undefined && !BOT_PERSONAS.some((p) => p.id === id))) {
      throw reject('UNKNOWN_PERSONA');
    }
    const creator = await this.deps.identity.verify(rawOptions);
    if (creator === null) throw reject('INVALID_IDENTITY');

    this.options = parsed.data;
    this.creatorUserId = creator.userId;
    this.lobby = new Lobby(parsed.data.mode);
    this.codeFailures = new RateLimiter(PRIVATE_CODE_MAX_FAILS, this.scheduler);
    if (parsed.data.visibility === 'private') this.code = generatePrivateCode(this.deps.rng);
    // Los límites reales los aplica `admissionError` con un error claro. Este tope es solo una red
    // de seguridad con margen para la conexión nueva de quien vuelve antes de cerrar la antigua.
    this.maxClients = 2 * HUMANS_REQUIRED[parsed.data.mode] + MAX_SPECTATORS + 1;
    this.state = new MusRoomState({
      mode: parsed.data.mode,
      visibility: parsed.data.visibility,
      status: 'lobby',
      seats: [0, 1, 2, 3].map(() => new SeatState(seatFields({ kind: 'empty' }))),
      spectators: 0,
    });

    this.onMessage(CLIENT_MESSAGES.takeSeat, (client: MusClient, payload: unknown) => {
      const message = takeSeatSchema.safeParse(payload);
      if (message.success) this.handleTakeSeat(client, message.data.seat);
      else this.sendError(client, 'INVALID_MESSAGE');
    });
    this.onMessage(CLIENT_MESSAGES.leaveSeat, (client: MusClient) => {
      this.handleLeaveSeat(client);
    });
    this.onMessage('*', (client: MusClient) => {
      this.sendError(client, 'INVALID_MESSAGE');
    });
    await this.sync();
    this.log.info({ mode: parsed.data.mode, visibility: parsed.data.visibility }, 'sala creada');
  }

  override async onAuth(_client: MusClient, options: unknown, context: AuthContext) {
    const identity = await this.deps.identity.verify(options);
    if (identity === null) throw reject('INVALID_IDENTITY');
    const join = joinRoomOptionsSchema.safeParse(options);
    if (!join.success) throw reject('INVALID_OPTIONS');
    if (this.code !== null && !this.knows(identity.userId)) {
      const key = context.ip ?? 'desconocida';
      if (this.codeFailures.isLimited(key)) throw reject('TOO_MANY_ATTEMPTS');
      if (!codeMatches(this.code, join.data.code)) {
        this.codeFailures.record(key);
        throw reject('WRONG_CODE');
      }
    }
    const refusal = this.admissionError(identity.userId, join.data.role);
    if (refusal !== null) throw reject(refusal);
    return { identity, role: join.data.role } satisfies ClientAuth;
  }

  override onJoin(client: MusClient): void {
    const auth = client.auth;
    /* v8 ignore next -- `onAuth` siempre deja `auth`. */
    if (auth === undefined) throw reject('INVALID_IDENTITY');
    // Varias peticiones pueden pasar `onAuth` a la vez: se vuelve a comprobar ya en orden.
    const refusal = this.admissionError(auth.identity.userId, auth.role, client.sessionId);
    if (refusal !== null) throw reject(refusal);
    this.replacePreviousSession(auth.identity.userId);
    this.participants.set(client.sessionId, { client, ...auth });

    if (auth.role === 'player') {
      if (this.lobby.isStarted) {
        this.lobby.setConnected(auth.identity.userId, true);
      } else if (this.lobby.mode === 'solo' && this.lobby.seatOf(auth.identity.userId) === null) {
        this.lobby.takeSeat(auth.identity.userId, auth.identity.nickname, 0);
      }
    }
    this.log.info({ userId: auth.identity.userId, role: auth.role }, 'entra en la sala');
    this.sendYou(client);
    this.maybeStart();
    void this.sync();
  }

  override onLeave(client: MusClient): void {
    const participant = this.participants.get(client.sessionId);
    this.participants.delete(client.sessionId);
    if (this.superseded.delete(client.sessionId) || participant === undefined) return;
    const { userId } = participant.identity;
    if (participant.role === 'player') {
      if (this.lobby.isStarted) this.lobby.setConnected(userId, false);
      else this.lobby.leaveSeat(userId);
    }
    this.log.info({ userId, role: participant.role }, 'sale de la sala');
    void this.sync();
  }

  override onUncaughtException(error: RoomException): void {
    if (error.cause instanceof ServerError) return; // rechazo esperado al unirse
    this.log.error({ err: error.cause, method: error.constructor.name }, 'error en la sala');
  }

  /** Se llama una vez, al sentarse todos los humanos. La tarea 4 arranca aquí la partida. */
  protected onMatchStarted(): void {
    this.log.info('partida empezada');
  }

  private handleTakeSeat(client: MusClient, seat: Seat): void {
    const player = this.player(client);
    if (player === null) return;
    const error = this.lobby.takeSeat(player.identity.userId, player.identity.nickname, seat);
    if (error !== null) {
      this.sendError(client, error);
      return;
    }
    this.sendYou(client);
    this.maybeStart();
    void this.sync();
  }

  private handleLeaveSeat(client: MusClient): void {
    const player = this.player(client);
    if (player === null) return;
    const error = this.lobby.leaveSeat(player.identity.userId);
    /* v8 ignore next 4 -- los jugadores solo reciben mensajes de asiento en el lobby. */
    if (error !== null) {
      this.sendError(client, error);
      return;
    }
    this.sendYou(client);
    void this.sync();
  }

  private maybeStart(): void {
    if (!this.lobby.isReady()) return;
    const error = this.lobby.start(this.botChoice(), this.deps.rng);
    /* v8 ignore next -- los personajes se validan al crear la sala. */
    if (error !== null) throw new Error(`No se pudo empezar: ${error}`);
    this.onMatchStarted();
  }

  private botChoice(): BotChoice {
    return this.options.bots;
  }

  /** Motivo para no admitir a alguien, o `null`. `ignore` es la sesión que se está uniendo. */
  private admissionError(userId: string, role: ClientRole, ignore?: string): RoomErrorCode | null {
    const others = [...this.participants.values()].filter(
      (p) => p.client.sessionId !== ignore && p.identity.userId !== userId,
    );
    if (role === 'spectator') {
      const spectators = others.filter((p) => p.role === 'spectator').length;
      return spectators >= MAX_SPECTATORS ? 'SPECTATORS_FULL' : null;
    }
    if (this.lobby.seatOf(userId) !== null) return null; // vuelve a su asiento (D7)
    if (this.lobby.isStarted) return 'NOT_IN_LOBBY';
    const players = others.filter((p) => p.role === 'player').length;
    return players >= HUMANS_REQUIRED[this.lobby.mode] ? 'PLAYERS_FULL' : null;
  }

  /** ¿Ya forma parte de la sala (creador, sentado o conectado)? No necesita el código. */
  private knows(userId: string): boolean {
    return (
      userId === this.creatorUserId ||
      this.lobby.seatOf(userId) !== null ||
      [...this.participants.values()].some((p) => p.identity.userId === userId)
    );
  }

  /** Si el usuario ya estaba conectado (otra pestaña o una conexión zombi), se cierra la antigua. */
  private replacePreviousSession(userId: string): void {
    for (const [sessionId, participant] of this.participants) {
      if (participant.identity.userId !== userId) continue;
      this.participants.delete(sessionId);
      this.superseded.add(sessionId);
      participant.client.leave(CloseCode.CONSENTED);
    }
  }

  private player(client: MusClient): Participant | null {
    const participant = this.participants.get(client.sessionId);
    if (participant?.role === 'player') return participant;
    this.sendError(client, 'NOT_A_PLAYER');
    return null;
  }

  private sendYou(client: MusClient): void {
    const participant = this.participants.get(client.sessionId);
    /* v8 ignore next -- solo se llama con participantes registrados. */
    if (participant === undefined) return;
    const message: YouMessage = {
      role: participant.role,
      seat: this.lobby.seatOf(participant.identity.userId),
      code: this.code,
    };
    client.send(SERVER_MESSAGES.you, message);
  }

  private sendError(client: MusClient, code: RoomErrorCode): void {
    const message: RoomErrorMessage = { code };
    client.send(SERVER_MESSAGES.error, message);
  }

  /** Refleja asientos, estado y espectadores en el estado público y en los metadatos. */
  private sync(): Promise<void> {
    const status: RoomStatus = this.lobby.isStarted ? 'playing' : 'lobby';
    const spectators = [...this.participants.values()].filter((p) => p.role === 'spectator').length;
    this.state.status = status;
    this.state.spectators = spectators;
    this.lobby.occupants.forEach((occupant, seat) => {
      Object.assign(this.state.seats[seat] ?? {}, seatFields(occupant));
    });
    return this.setMetadata({
      mode: this.lobby.mode,
      visibility: this.options.visibility,
      hasCode: this.code !== null,
      seatsTaken: this.lobby.humansSeated(),
      spectators,
      status,
    });
  }
}

function seatFields(occupant: SeatOccupant) {
  return {
    kind: occupant.kind,
    nickname:
      occupant.kind === 'human'
        ? occupant.nickname
        : occupant.kind === 'bot'
          ? occupant.persona.name
          : '',
    personaId: occupant.kind === 'bot' ? occupant.persona.id : '',
    connected: occupant.kind === 'human' ? occupant.connected : occupant.kind === 'bot',
  };
}

/** Crea la clase de sala con sus dependencias (Colyseus instancia la clase, sin argumentos). */
export function musRoomWith(deps: MusRoomDeps): new () => MusRoom {
  return class ConfiguredMusRoom extends MusRoom {
    protected readonly deps = deps;
  };
}
