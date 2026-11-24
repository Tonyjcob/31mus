// Una mesa completa: el lobby con sus asientos y, cuando están todos, la partida (CLAUDE.md §7).
// Decide qué pasa cuando un jugador se sienta, entra, cae o vuelve (D7, D20). Sin Colyseus: la sala
// solo traduce conexiones y mensajes a estas llamadas.
import type { Rng, Seat } from '@31mus/engine';
import type {
  ActionResultMessage,
  BotChoice,
  GameActionMessage,
  RoomMode,
  RoomStatus,
} from '@31mus/shared';

import type { Logger } from '../infra/logger.js';
import type { Scheduler } from '../infra/scheduler.js';
import { Lobby, type LobbyResult } from './lobby.js';
import { TableSession, type Recipient, type TableEnd, type TableTiming } from './table-session.js';

export interface TableDeps {
  readonly mode: RoomMode;
  readonly bots: BotChoice;
  readonly scheduler: Scheduler;
  readonly rng: Rng;
  readonly logger: Logger;
  readonly timing: TableTiming;
  recipients(): Iterable<Recipient>;
  onStatusChange(): void;
  onClose(end: TableEnd): void;
}

/** Quién se conecta o desconecta: un jugador con su identidad. */
export interface Presence {
  readonly userId: string;
  readonly nickname: string;
}

export class Table {
  readonly lobby: Lobby;
  private session: TableSession | null = null;

  constructor(private readonly deps: TableDeps) {
    this.lobby = new Lobby(deps.mode);
  }

  get status(): RoomStatus {
    return this.session?.status ?? 'lobby';
  }

  /** Asiento del jugador en una partida que no ha terminado, o `null`. */
  seatInMatch(userId: string): Seat | null {
    if (this.session === null || this.session.status === 'finished') return null;
    return this.lobby.seatOf(userId);
  }

  /**
   * Un jugador se conecta o se desconecta: en el lobby se sienta (solo) o se levanta; en la
   * partida recupera su asiento o se lo cede al bot (D7), y la mesa se pausa si no queda nadie (D20).
   */
  presenceChanged({ userId, nickname }: Presence, connected: boolean): void {
    const seat = this.lobby.seatOf(userId);
    if (this.lobby.isStarted) {
      if (seat === null) return;
      this.lobby.setConnected(userId, connected);
      this.session?.connectionChanged(seat);
    } else if (!connected) {
      this.lobby.leaveSeat(userId);
    } else if (this.lobby.mode === 'solo' && seat === null) {
      this.lobby.takeSeat(userId, nickname, 0);
      this.maybeStart();
    }
  }

  /** Sentarse en `seat` o levantarse (`null`), solo en el lobby. */
  sit({ userId, nickname }: Presence, seat: Seat | null): LobbyResult {
    const error =
      seat === null ? this.lobby.leaveSeat(userId) : this.lobby.takeSeat(userId, nickname, seat);
    if (error === null) this.maybeStart();
    return error;
  }

  act(userId: string, message: GameActionMessage): ActionResultMessage {
    const seat = this.lobby.seatOf(userId);
    if (this.session === null || seat === null) {
      return { actionId: message.actionId, ok: false, code: 'MATCH_NOT_RUNNING' };
    }
    return this.session.act(seat, message);
  }

  /** Envía la partida en curso a quien acaba de entrar o volver. */
  sendCurrent(recipient: Recipient): void {
    this.session?.sendCurrent(recipient);
  }

  dispose(): void {
    this.session?.dispose();
  }

  private maybeStart(): void {
    if (!this.lobby.isReady()) return;
    const { bots, rng, scheduler, logger, timing } = this.deps;
    const error = this.lobby.start(bots, rng);
    /* v8 ignore next -- los personajes se validan al crear la sala. */
    if (error !== null) throw new Error(`No se pudo empezar: ${error}`);
    this.session = new TableSession({
      lobby: this.lobby,
      scheduler,
      rng,
      logger,
      timing,
      recipients: () => this.deps.recipients(),
      onStatusChange: () => {
        this.deps.onStatusChange();
      },
      onClose: (end) => {
        this.deps.onClose(end);
      },
    });
    this.session.start();
  }
}
