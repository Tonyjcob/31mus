// Sala de mus en Colyseus (CLAUDE.md §7, ADR-0004). Adaptador fino: valida la entrada con Zod,
// delega en `Admission` (quién entra), `Lobby` (asientos) y `TableSession` (partida), y refleja el
// estado público.
import { BOT_PERSONAS } from '@31mus/bots';
import type { Seat, Viewer } from '@31mus/engine';
import {
  CLIENT_MESSAGES,
  MAX_SPECTATORS,
  SERVER_MESSAGES,
  createRoomOptionsSchema,
  gameActionSchema,
  joinRoomOptionsSchema,
  takeSeatSchema,
  type ActionResultMessage,
  type CreateRoomOptions,
  type RoomErrorCode,
  type RoomErrorMessage,
  type YouMessage,
} from '@31mus/shared';
import { Room, ServerError, type AuthContext, type RoomException } from '@colyseus/core';

import type { Logger } from '../infra/logger.js';
import { clockScheduler, type Scheduler } from '../infra/scheduler.js';
import { HUMANS_REQUIRED, Lobby } from '../table/lobby.js';
import { DEFAULT_TABLE_TIMING, TableSession, type Recipient } from '../table/table-session.js';
import { Admission } from './admission.js';
import { Participants, type ClientAuth, type MusClient, type Participant } from './participants.js';
import { MusRoomState, SeatState, seatFields } from './room-state.js';
import { reject, type MusRoomDeps, type MusRoomMetadata } from './room-types.js';

export type { ClientAuth } from './participants.js';
export type { MusRoomDeps, MusRoomMetadata } from './room-types.js';

export abstract class MusRoom extends Room<{
  state: MusRoomState;
  metadata: MusRoomMetadata;
  client: MusClient;
}> {
  protected abstract readonly deps: MusRoomDeps;

  private log!: Logger;
  private scheduler!: Scheduler;
  private options!: CreateRoomOptions;
  private lobby!: Lobby;
  private admission!: Admission;
  private session: TableSession | null = null;
  private readonly participants = new Participants();

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

    const { mode, visibility } = parsed.data;
    this.options = parsed.data;
    this.lobby = new Lobby(mode);
    this.admission = new Admission({
      lobby: this.lobby,
      participants: this.participants,
      scheduler: this.scheduler,
      rng: this.deps.rng,
      isPrivate: visibility === 'private',
      creatorUserId: creator.userId,
    });
    // Los límites reales los aplica `Admission` con un error claro. Este tope es solo una red de
    // seguridad con margen para la conexión nueva de quien vuelve antes de cerrar la antigua.
    this.maxClients = 2 * HUMANS_REQUIRED[mode] + MAX_SPECTATORS + 1;
    this.state = new MusRoomState({
      mode,
      visibility,
      status: 'lobby',
      seats: [0, 1, 2, 3].map(() => new SeatState(seatFields({ kind: 'empty' }))),
      spectators: 0,
    });
    this.registerMessages();
    await this.sync();
    this.log.info({ mode, visibility }, 'sala creada');
  }

  override async onAuth(_client: MusClient, options: unknown, context: AuthContext) {
    const identity = await this.deps.identity.verify(options);
    if (identity === null) throw reject('INVALID_IDENTITY');
    const join = joinRoomOptionsSchema.safeParse(options);
    if (!join.success) throw reject('INVALID_OPTIONS');
    const refusal =
      this.admission.checkCode(identity.userId, context.ip ?? 'desconocida', join.data.code) ??
      this.admission.refusal(identity.userId, join.data.role);
    if (refusal !== null) throw reject(refusal);
    return { identity, role: join.data.role } satisfies ClientAuth;
  }

  override onJoin(client: MusClient): void {
    const auth = client.auth;
    /* v8 ignore next -- `onAuth` siempre deja `auth`. */
    if (auth === undefined) throw reject('INVALID_IDENTITY');
    // Varias peticiones pueden pasar `onAuth` a la vez: se vuelve a comprobar ya en orden.
    const refusal = this.admission.refusal(auth.identity.userId, auth.role, client.sessionId);
    if (refusal !== null) throw reject(refusal);
    this.participants.add({ client, ...auth });

    const { userId, nickname } = auth.identity;
    const seat = this.lobby.seatOf(userId);
    if (auth.role === 'player' && this.lobby.isStarted && seat !== null) {
      this.lobby.setConnected(userId, true);
      this.session?.connectionChanged(seat);
    } else if (auth.role === 'player' && this.lobby.mode === 'solo' && seat === null) {
      this.lobby.takeSeat(userId, nickname, 0);
    }
    this.log.info({ userId, role: auth.role }, 'entra en la sala');
    this.sendYou(client);
    this.session?.sendCurrent(this.recipient(client));
    this.maybeStart();
    void this.sync();
  }

  override onLeave(client: MusClient): void {
    const participant = this.participants.remove(client.sessionId);
    if (participant === null) return;
    const { userId } = participant.identity;
    const seat = this.lobby.seatOf(userId);
    if (participant.role === 'player' && this.lobby.isStarted && seat !== null) {
      this.lobby.setConnected(userId, false);
      this.session?.connectionChanged(seat);
    } else if (participant.role === 'player') {
      this.lobby.leaveSeat(userId);
    }
    this.log.info({ userId, role: participant.role }, 'sale de la sala');
    void this.sync();
  }

  override onDispose(): void {
    this.session?.dispose();
  }

  override onUncaughtException(error: RoomException): void {
    if (error.cause instanceof ServerError) return; // rechazo esperado al unirse
    this.log.error({ err: error.cause, method: error.constructor.name }, 'error en la sala');
  }

  private registerMessages(): void {
    this.onMessage(CLIENT_MESSAGES.takeSeat, (client: MusClient, payload: unknown) => {
      const message = takeSeatSchema.safeParse(payload);
      if (message.success) this.handleSeat(client, message.data.seat);
      else this.sendError(client, 'INVALID_MESSAGE');
    });
    this.onMessage(CLIENT_MESSAGES.leaveSeat, (client: MusClient) => {
      this.handleSeat(client, null);
    });
    this.onMessage(CLIENT_MESSAGES.action, (client: MusClient, payload: unknown) => {
      this.handleAction(client, payload);
    });
    this.onMessage('*', (client: MusClient) => {
      this.sendError(client, 'INVALID_MESSAGE');
    });
  }

  /** Sentarse en `seat` o levantarse (`null`), solo en el lobby. */
  private handleSeat(client: MusClient, seat: Seat | null): void {
    const player = this.player(client);
    if (player === null) return;
    const { userId, nickname } = player.identity;
    const error =
      seat === null ? this.lobby.leaveSeat(userId) : this.lobby.takeSeat(userId, nickname, seat);
    if (error !== null) {
      this.sendError(client, error);
      return;
    }
    this.sendYou(client);
    this.maybeStart();
    void this.sync();
  }

  private handleAction(client: MusClient, payload: unknown): void {
    const message = gameActionSchema.safeParse(payload);
    if (!message.success) {
      this.sendError(client, 'INVALID_MESSAGE');
      return;
    }
    const player = this.player(client);
    if (player === null) return;
    const seat = this.lobby.seatOf(player.identity.userId);
    const result: ActionResultMessage =
      this.session === null || seat === null
        ? { actionId: message.data.actionId, ok: false, code: 'MATCH_NOT_RUNNING' }
        : this.session.act(seat, message.data);
    client.send(SERVER_MESSAGES.actionResult, result);
  }

  private maybeStart(): void {
    if (!this.lobby.isReady()) return;
    const error = this.lobby.start(this.options.bots, this.deps.rng);
    /* v8 ignore next -- los personajes se validan al crear la sala. */
    if (error !== null) throw new Error(`No se pudo empezar: ${error}`);
    this.session = new TableSession({
      lobby: this.lobby,
      scheduler: this.scheduler,
      rng: this.deps.rng,
      logger: this.log,
      timing: { ...DEFAULT_TABLE_TIMING, ...this.deps.timing },
      recipients: () => this.participants.values().map((p) => this.recipient(p.client)),
      onStatusChange: () => void this.sync(),
      onClose: (end) => {
        this.log.info({ end }, 'mesa cerrada');
        void this.disconnect();
      },
    });
    this.session.start();
  }

  /** Destinatario de la partida: su asiento si es jugador sentado; si no, espectador. */
  private recipient(client: MusClient): Recipient {
    const participant = this.participants.get(client.sessionId);
    const seat =
      participant?.role === 'player' ? this.lobby.seatOf(participant.identity.userId) : null;
    const viewer: Viewer = seat ?? 'spectator';
    return {
      viewer,
      send: (type, payload) => {
        client.send(type, payload);
      },
    };
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
      code: this.admission.code,
    };
    client.send(SERVER_MESSAGES.you, message);
  }

  private sendError(client: MusClient, code: RoomErrorCode): void {
    const message: RoomErrorMessage = { code };
    client.send(SERVER_MESSAGES.error, message);
  }

  /** Refleja asientos, estado y espectadores en el estado público y en los metadatos. */
  private sync(): Promise<void> {
    const status = this.session?.status ?? 'lobby';
    const spectators = this.participants.spectators();
    this.state.status = status;
    this.state.spectators = spectators;
    this.lobby.occupants.forEach((occupant, seat) => {
      Object.assign(this.state.seats[seat] ?? {}, seatFields(occupant));
    });
    return this.setMetadata({
      mode: this.lobby.mode,
      visibility: this.options.visibility,
      hasCode: this.admission.code !== null,
      seatsTaken: this.lobby.humansSeated(),
      spectators,
      status,
    });
  }
}

/** Crea la clase de sala con sus dependencias (Colyseus instancia la clase, sin argumentos). */
export function musRoomWith(deps: MusRoomDeps): new () => MusRoom {
  return class ConfiguredMusRoom extends MusRoom {
    protected readonly deps = deps;
  };
}
