// Sala de mus en Colyseus (CLAUDE.md §7, ADR-0004). Adaptador fino: valida la entrada con Zod,
// traduce conexiones y mensajes a `Admission` (quién entra), `Table` (asientos y partida) y
// `RoomChat` (chat y reacciones), y refleja el estado público.
import { BOT_PERSONAS } from '@31mus/bots';
import type { Seat } from '@31mus/engine';
import {
  CLIENT_MESSAGES,
  MAX_CLIENT_MESSAGES_PER_SECOND,
  MAX_SPECTATORS,
  SERVER_MESSAGES,
  createRoomOptionsSchema,
  gameActionSchema,
  joinRoomOptionsSchema,
  takeSeatSchema,
  type CreateRoomOptions,
  type MessageAuthor,
} from '@31mus/shared';
import { Room, ServerError, type AuthContext, type RoomException } from '@colyseus/core';

import { RoomChat, type ChatOutcome } from '../chat/room-chat.js';
import type { Logger } from '../infra/logger.js';
import { clockScheduler } from '../infra/scheduler.js';
import { HUMANS_REQUIRED } from '../table/lobby.js';
import { DEFAULT_TABLE_TIMING, type Recipient } from '../table/table-session.js';
import { Table } from '../table/table.js';
import { Admission } from './admission.js';
import { Participants, type ClientAuth, type MusClient, type Participant } from './participants.js';
import { MusRoomState, SeatState, seatFields } from './room-state.js';
import { recipientOf, sendError, sendYou } from './room-messages.js';
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
  private options!: CreateRoomOptions;
  private table!: Table;
  private admission!: Admission;
  private chat!: RoomChat;
  private readonly participants = new Participants();

  override async onCreate(rawOptions: unknown): Promise<void> {
    this.log = this.deps.logger.child({ roomId: this.roomId });
    const scheduler = clockScheduler(this.clock);
    const parsed = createRoomOptionsSchema.safeParse(rawOptions);
    if (!parsed.success) throw reject('INVALID_OPTIONS');
    const chosen = [parsed.data.bots.partner, ...(parsed.data.bots.rivals ?? [])];
    if (chosen.some((id) => id !== undefined && !BOT_PERSONAS.some((p) => p.id === id))) {
      throw reject('UNKNOWN_PERSONA');
    }
    const creator = await this.deps.identity.verify(rawOptions);
    if (creator === null) throw reject('INVALID_IDENTITY');

    const { mode, visibility, bots } = parsed.data;
    this.options = parsed.data;
    this.table = new Table({
      roomId: this.roomId,
      mode,
      bots,
      scheduler,
      rng: this.deps.rng,
      logger: this.log,
      timing: { ...DEFAULT_TABLE_TIMING, ...this.deps.timing },
      matchLog: this.deps.matchLog,
      recipients: () => this.participants.online().map((p) => this.recipient(p.client)),
      onStatusChange: () => void this.sync(),
      onClose: (end) => {
        this.log.info({ end }, 'mesa cerrada');
        void this.disconnect();
      },
    });
    this.admission = new Admission({
      lobby: this.table.lobby,
      participants: this.participants,
      scheduler,
      rng: this.deps.rng,
      isPrivate: visibility === 'private',
      creatorUserId: creator.userId,
    });
    this.chat = new RoomChat(scheduler);
    // Los límites reales los aplica `Admission` con un error claro. Este tope es solo una red de
    // seguridad con margen para la conexión nueva de quien vuelve antes de cerrar la antigua.
    this.maxClients = 2 * HUMANS_REQUIRED[mode] + MAX_SPECTATORS + 1;
    this.maxMessagesPerSecond = MAX_CLIENT_MESSAGES_PER_SECOND;
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
    this.log.info({ userId: auth.identity.userId, role: auth.role }, 'entra en la sala');
    this.arrived(client, auth);
  }

  /**
   * La conexión cayó sin despedirse. Si es un jugador de una partida en curso, su asiento pasa al
   * bot y se le guarda la sesión hasta el final (D7); si no, cuenta como salida (`onLeave`).
   */
  override onDrop(client: MusClient): void {
    const participant = this.participants.get(client.sessionId);
    if (participant?.role !== 'player') return;
    if (this.table.seatInMatch(participant.identity.userId) === null) return;
    if (!this.participants.hold(client.sessionId, this.allowReconnection(client, 'manual'))) return;
    this.log.info({ userId: participant.identity.userId }, 'conexión caída');
    this.presenceChanged(participant, false);
    void this.sync();
  }

  override onReconnect(client: MusClient): void {
    const participant = this.participants.reconnect(client);
    /* v8 ignore next -- solo se reconecta una sesión que `onDrop` dejó registrada. */
    if (participant === null) return;
    this.log.info({ userId: participant.identity.userId }, 'reconectado');
    this.arrived(client, participant);
  }

  override onLeave(client: MusClient): void {
    const participant = this.participants.remove(client.sessionId);
    if (participant === null) return;
    // Si la conexión ya había caído, su asiento ya estaba en manos del bot.
    if (participant.dropped === null) this.presenceChanged(participant, false);
    this.log.info({ userId: participant.identity.userId, role: participant.role }, 'sale');
    void this.sync();
  }

  override onDispose(): void {
    this.table.dispose();
  }

  override onUncaughtException(error: RoomException): void {
    if (error.cause instanceof ServerError) return; // rechazo esperado al unirse
    this.log.error({ err: error.cause, method: error.constructor.name }, 'error en la sala');
  }

  private registerMessages(): void {
    this.onMessage(CLIENT_MESSAGES.takeSeat, (client: MusClient, payload: unknown) => {
      const message = takeSeatSchema.safeParse(payload);
      if (message.success) this.handleSeat(client, message.data.seat);
      else sendError(client, 'INVALID_MESSAGE');
    });
    this.onMessage(CLIENT_MESSAGES.leaveSeat, (client: MusClient) => {
      this.handleSeat(client, null);
    });
    this.onMessage(CLIENT_MESSAGES.action, (client: MusClient, payload: unknown) => {
      const message = gameActionSchema.safeParse(payload);
      const player = message.success ? this.player(client) : null;
      if (!message.success) sendError(client, 'INVALID_MESSAGE');
      else if (player !== null) {
        const result = this.table.act(player.identity.userId, message.data);
        client.send(SERVER_MESSAGES.actionResult, result);
      }
    });
    this.onMessage(CLIENT_MESSAGES.chat, (client: MusClient, payload: unknown) => {
      this.relay(client, SERVER_MESSAGES.chat, (id, from) => this.chat.message(id, from, payload));
    });
    this.onMessage(CLIENT_MESSAGES.reaction, (client: MusClient, payload: unknown) => {
      this.relay(client, SERVER_MESSAGES.reaction, (id, from) =>
        this.chat.reaction(id, from, payload),
      );
    });
    this.onMessage('*', (client: MusClient) => {
      sendError(client, 'INVALID_MESSAGE');
    });
  }

  /** Alguien entra o vuelve: ocupa su asiento si le toca y recibe quién es y la partida. */
  private arrived(client: MusClient, participant: ClientAuth): void {
    this.presenceChanged(participant, true);
    this.sendYou(client);
    this.table.sendCurrent(this.recipient(client));
    void this.sync();
  }

  private presenceChanged(participant: ClientAuth, connected: boolean): void {
    if (participant.role === 'player') this.table.presenceChanged(participant.identity, connected);
  }

  /** Sentarse en `seat` o levantarse (`null`), solo en el lobby. */
  private handleSeat(client: MusClient, seat: Seat | null): void {
    const player = this.player(client);
    if (player === null) return;
    const error = this.table.sit(player.identity, seat);
    if (error !== null) {
      sendError(client, error);
      return;
    }
    this.sendYou(client);
    void this.sync();
  }

  /** Chat o reacción: el autor lo pone el servidor; se difunde a todos los conectados. */
  private relay<T>(
    client: MusClient,
    type: string,
    build: (userId: string, from: MessageAuthor) => ChatOutcome<T>,
  ): void {
    const participant = this.participants.get(client.sessionId);
    /* v8 ignore next -- todo cliente que envía mensajes está registrado. */
    if (participant === undefined) return;
    const { userId, nickname } = participant.identity;
    const outcome = build(userId, {
      nickname,
      role: participant.role,
      seat: this.seatOf(participant),
    });
    if (!outcome.ok) {
      sendError(client, outcome.code);
      return;
    }
    for (const { client: to } of this.participants.online()) to.send(type, outcome.message);
  }

  /** Asiento del participante si es un jugador sentado. */
  private seatOf(participant: ClientAuth | undefined): Seat | null {
    if (participant?.role !== 'player') return null;
    return this.table.lobby.seatOf(participant.identity.userId);
  }

  private recipient(client: MusClient): Recipient {
    return recipientOf(client, this.seatOf(this.participants.get(client.sessionId)));
  }

  private player(client: MusClient): Participant | null {
    const participant = this.participants.get(client.sessionId);
    if (participant?.role === 'player') return participant;
    sendError(client, 'NOT_A_PLAYER');
    return null;
  }

  private sendYou(client: MusClient): void {
    const participant = this.participants.get(client.sessionId);
    /* v8 ignore next -- solo se llama con participantes registrados. */
    if (participant === undefined) return;
    sendYou(client, participant.role, this.seatOf(participant), this.admission.code);
  }

  /** Refleja asientos, estado y espectadores en el estado público y en los metadatos. */
  private sync(): Promise<void> {
    const { lobby, status } = this.table;
    const spectators = this.participants.spectators();
    this.state.status = status;
    this.state.spectators = spectators;
    lobby.occupants.forEach((occupant, seat) => {
      Object.assign(this.state.seats[seat] ?? {}, seatFields(occupant));
    });
    return this.setMetadata({
      mode: lobby.mode,
      visibility: this.options.visibility,
      hasCode: this.admission.code !== null,
      seatsTaken: lobby.humansSeated(),
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
