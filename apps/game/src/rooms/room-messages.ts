// Mensajes privados de la sala a un cliente: quién es, errores y destinatario de la partida.
import type { Seat } from '@31mus/engine';
import {
  SERVER_MESSAGES,
  type ClientRole,
  type RoomErrorCode,
  type RoomErrorMessage,
  type YouMessage,
} from '@31mus/shared';

import type { Recipient } from '../table/table-session.js';
import type { MusClient } from './participants.js';

export function sendError(client: MusClient, code: RoomErrorCode): void {
  const message: RoomErrorMessage = { code };
  client.send(SERVER_MESSAGES.error, message);
}

/** Quién es el cliente en la sala: rol, asiento y, si la sala es privada, su código. */
export function sendYou(
  client: MusClient,
  role: ClientRole,
  seat: Seat | null,
  code: string | null,
): void {
  const message: YouMessage = { role, seat, code };
  client.send(SERVER_MESSAGES.you, message);
}

/** Destinatario de la partida: su asiento si es jugador sentado; si no, espectador. */
export function recipientOf(client: MusClient, seat: Seat | null): Recipient {
  return {
    viewer: seat ?? 'spectator',
    send: (type, payload) => {
      client.send(type, payload);
    },
  };
}
