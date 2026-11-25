// Conexión del cliente de consola (herramienta de desarrollo): une a una sala con el SDK de
// Colyseus, guarda la última vista y lo que hace falta para mostrarla, y envía intenciones.
// Solo ve lo que el servidor le manda: es un cliente más, sin acceso al estado de la partida.
import { randomUUID } from 'node:crypto';

import type { Action, Seat } from '@31mus/engine';
import {
  CLIENT_MESSAGES,
  MUS_ROOM_NAME,
  SERVER_MESSAGES,
  type ActionResultMessage,
  type ChatMessage,
  type GameEventsMessage,
  type GameViewMessage,
  type ReactionMessage,
  type RoomErrorMessage,
  type YouMessage,
} from '@31mus/shared';
import { ColyseusSDK, type Room as ClientRoom } from '@colyseus/sdk';

import type { PublicRoomState } from '../testing/test-server.js';
import { formatEvent, seatLabel } from './format.js';

/** Argumentos del script, sin el `--` que pnpm deja pasar tal cual. */
export function scriptArgs(): string[] {
  const args = process.argv.slice(2);
  return args[0] === '--' ? args.slice(1) : args;
}

export interface CliIdentity {
  readonly userId: string;
  readonly nickname: string;
}

export type CliTarget =
  | { readonly kind: 'create'; readonly options: Record<string, unknown> }
  | {
      readonly kind: 'join';
      readonly roomId: string;
      readonly role: 'player' | 'spectator';
      readonly code?: string;
    };

export interface CliHandlers {
  /** Llega una vista nueva de la partida. */
  onView?(view: GameViewMessage): void;
  /** La sala se cerró o nos echó. */
  onLeave?(code: number): void;
}

export class CliRoom {
  seat: Seat | null = null;
  code: string | null = null;
  lastView: GameViewMessage | null = null;
  matchWinner: number | null = null;

  private constructor(
    readonly room: ClientRoom,
    private readonly out: (line: string) => void,
    private readonly handlers: CliHandlers,
  ) {
    room.onMessage(SERVER_MESSAGES.you, (you: YouMessage) => {
      this.seat = you.seat;
      this.code = you.code;
    });
    room.onMessage(SERVER_MESSAGES.events, (message: GameEventsMessage) => {
      for (const event of message.events) {
        if (event.type === 'matchWon') this.matchWinner = event.team;
        const line = formatEvent(event, this.who);
        if (line !== null) this.out(line);
      }
    });
    room.onMessage(SERVER_MESSAGES.view, (view: GameViewMessage) => {
      // La misma versión llega dos veces al entrar (estado actual y primera publicación).
      if (view.version === this.lastView?.version) return;
      if (view.view.viewer !== 'spectator') this.seat = view.view.viewer;
      this.lastView = view;
      this.handlers.onView?.(view);
    });
    room.onMessage(SERVER_MESSAGES.actionResult, (result: ActionResultMessage) => {
      if (!result.ok) this.out(`(acción rechazada: ${result.code})`);
    });
    room.onMessage(SERVER_MESSAGES.chat, (message: ChatMessage) => {
      this.out(`💬 ${message.from.nickname}: ${message.text}`);
    });
    room.onMessage(SERVER_MESSAGES.reaction, (message: ReactionMessage) => {
      this.out(`${message.emoji} (${message.from.nickname})`);
    });
    room.onMessage(SERVER_MESSAGES.error, (error: RoomErrorMessage) => {
      this.out(`(error: ${error.code})`);
    });
    room.onLeave((code) => {
      this.handlers.onLeave?.(code);
    });
  }

  static async open(
    url: string,
    identity: CliIdentity,
    target: CliTarget,
    out: (line: string) => void,
    handlers: CliHandlers = {},
  ): Promise<CliRoom> {
    const sdk = new ColyseusSDK(url);
    const room =
      target.kind === 'create'
        ? await sdk.create(MUS_ROOM_NAME, { ...identity, ...target.options })
        : await sdk.joinById(target.roomId, {
            ...identity,
            role: target.role,
            ...(target.code === undefined ? {} : { code: target.code }),
          });
    return new CliRoom(room, out, handlers);
  }

  /** Nombre de un asiento desde el nuestro, con el apodo o personaje del estado público. */
  readonly who = (seat: Seat): string => {
    const state = this.room.state as PublicRoomState | undefined;
    const names = state?.seats.map((s) => s.nickname) ?? [];
    return seatLabel(seat, this.seat, names);
  };

  act(action: Action): void {
    const version = this.lastView?.version ?? 0;
    this.room.send(CLIENT_MESSAGES.action, { actionId: randomUUID(), version, action });
  }

  send(type: string, payload: unknown): void {
    this.room.send(type, payload);
  }

  leave(): Promise<number> {
    return this.room.leave();
  }
}
