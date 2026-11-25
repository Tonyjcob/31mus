// Contrato cliente ↔ servidor de juego (ADR-0004 §1 y §7).
// Lo que envía el cliente se valida con estos esquemas; lo que envía el servidor solo se tipa:
// el servidor lo construye a partir del motor y el cliente confía en él.
import type { Action, GameEvent, PlayerView, Seat } from '@31mus/engine';
import { z } from 'zod';

import { REACTIONS, type Reaction } from '../constants.js';
import { actionSchema, seatSchema } from './actions.js';
import {
  chatTextSchema,
  nicknameSchema,
  personaIdSchema,
  privateCodeSchema,
  userIdSchema,
} from './text.js';

// --- Salas ---

/** Modos de sala (CLAUDE.md §7). `ranked` solo lo crea el emparejador (H7). */
export const ROOM_MODES = ['solo', 'duo_vs_bots', '2v2', 'ranked'] as const;
export type RoomMode = (typeof ROOM_MODES)[number];

/** Modos que un jugador puede crear desde el lobby (salas casuales). */
export const CASUAL_MODES = ['solo', 'duo_vs_bots', '2v2'] as const satisfies readonly RoomMode[];

export const ROOM_VISIBILITIES = ['public', 'private'] as const;
export type RoomVisibility = (typeof ROOM_VISIBILITIES)[number];

export const ROOM_STATUSES = ['lobby', 'playing', 'paused', 'finished'] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const CLIENT_ROLES = ['player', 'spectator'] as const;
export type ClientRole = (typeof CLIENT_ROLES)[number];

/** Nombre del tipo de sala registrado en Colyseus. */
export const MUS_ROOM_NAME = 'mus';

/**
 * Personajes de los bots, elegidos al crear la sala (CLAUDE.md §7): los dos rivales y, en `solo`,
 * el compañero. Lo que no se elige se sortea. No se puede repetir personaje en una mesa.
 */
export const botChoiceSchema = z
  .strictObject({
    partner: personaIdSchema.optional(),
    rivals: z.tuple([personaIdSchema, personaIdSchema]).optional(),
  })
  .refine(({ partner, rivals = [] }) => {
    const ids = partner === undefined ? rivals : [partner, ...rivals];
    return new Set(ids).size === ids.length;
  }, 'Personaje repetido');
export type BotChoice = z.output<typeof botChoiceSchema>;

/** Opciones al crear una sala casual. */
export const createRoomOptionsSchema = z
  .object({
    mode: z.enum(CASUAL_MODES),
    visibility: z.enum(ROOM_VISIBILITIES).default('public'),
    bots: botChoiceSchema.default({}),
  })
  .refine(({ mode, bots }) => mode === 'solo' || bots.partner === undefined, {
    message: 'Solo hay compañero bot en el modo solo',
    path: ['bots', 'partner'],
  })
  .refine(({ mode, bots }) => mode !== '2v2' || bots.rivals === undefined, {
    message: 'En 2 contra 2 no hay bots',
    path: ['bots', 'rivals'],
  });
export type CreateRoomOptions = z.output<typeof createRoomOptionsSchema>;

/** Opciones al unirse a una sala (también al crearla). El código solo se pide en las privadas. */
export const joinRoomOptionsSchema = z.object({
  role: z.enum(CLIENT_ROLES).default('player'),
  code: privateCodeSchema.optional(),
});
export type JoinRoomOptions = z.output<typeof joinRoomOptionsSchema>;

/**
 * Identidad de desarrollo (ADR-0004 §3): hasta H6 el cliente dice quién es. El servidor se niega a
 * usarla en producción; en H6 la sustituye el ticket de juego de la API.
 */
export const devIdentitySchema = z.object({
  userId: userIdSchema,
  nickname: nicknameSchema,
});
export type DevIdentity = z.output<typeof devIdentitySchema>;

// --- Cliente → servidor ---

export const CLIENT_MESSAGES = {
  takeSeat: 'seat:take',
  leaveSeat: 'seat:leave',
  action: 'game:action',
  chat: 'chat:send',
  reaction: 'reaction:send',
} as const;

export const takeSeatSchema = z.strictObject({ seat: seatSchema });
export const leaveSeatSchema = z.strictObject({});
/**
 * Una acción de juego. `actionId` hace la acción idempotente (un reenvío no se aplica dos veces) y
 * `version` es la de la vista sobre la que se decidió: si la partida avanzó, se rechaza.
 */
export const gameActionSchema = z.strictObject({
  actionId: z.uuid(),
  version: z.number().int().min(0),
  action: actionSchema,
});
export const chatSendSchema = z.strictObject({ text: chatTextSchema });
export const reactionSendSchema = z.strictObject({ emoji: z.enum(REACTIONS) });

export type TakeSeatMessage = z.output<typeof takeSeatSchema>;
export type GameActionMessage = z.output<typeof gameActionSchema>;
export type ChatSendMessage = z.output<typeof chatSendSchema>;
export type ReactionSendMessage = z.output<typeof reactionSendSchema>;

// --- Servidor → cliente ---

export const SERVER_MESSAGES = {
  view: 'game:view',
  events: 'game:events',
  actionResult: 'game:actionResult',
  chat: 'chat:message',
  reaction: 'reaction',
  error: 'room:error',
  you: 'room:you',
} as const;

/** Mensaje privado: quién es el destinatario en la sala. Se reenvía al cambiar de asiento. */
export interface YouMessage {
  readonly role: ClientRole;
  readonly seat: Seat | null;
  /** Código de la sala privada, para compartirlo; `null` en las públicas. */
  readonly code: string | null;
}

/** Vista completa de la partida para un jugador o espectador, tras cada cambio. */
export interface GameViewMessage {
  readonly version: number;
  readonly view: PlayerView;
  /** Acciones que puede hacer ahora el destinatario (vacío si no le toca o es espectador). */
  readonly legal: readonly Action[];
  /** Fin del turno del destinatario (ms desde epoch del servidor) o `null` si no le toca. */
  readonly deadline: number | null;
  /** Instante del servidor al enviar, para corregir el desfase del reloj del cliente. */
  readonly serverNow: number;
}

/** Eventos del último paso, ya filtrados por `getEventView` para el destinatario. */
export interface GameEventsMessage {
  readonly version: number;
  readonly events: readonly GameEvent[];
}

export const ACTION_ERROR_CODES = [
  'NOT_YOUR_TURN',
  'ILLEGAL_ACTION',
  'STALE_VERSION',
  'MATCH_NOT_RUNNING',
] as const;
export type ActionErrorCode = (typeof ACTION_ERROR_CODES)[number];

export type ActionResultMessage =
  | { readonly actionId: string; readonly ok: true }
  | { readonly actionId: string; readonly ok: false; readonly code: ActionErrorCode };

/** Autor de un mensaje de chat o reacción: lo pone el servidor, nunca el cliente. */
export interface MessageAuthor {
  readonly nickname: string;
  readonly role: ClientRole;
  readonly seat: Seat | null;
}

export interface ChatMessage {
  readonly id: string;
  readonly from: MessageAuthor;
  readonly text: string;
  readonly at: number;
}

export interface ReactionMessage {
  readonly from: MessageAuthor;
  readonly emoji: Reaction;
  readonly at: number;
}

/** Errores de sala: al unirse (rechazo de Colyseus) o como mensaje `room:error`. */
export const ROOM_ERROR_CODES = [
  'INVALID_MESSAGE',
  'INVALID_IDENTITY',
  'RATE_LIMITED',
  'WRONG_CODE',
  'TOO_MANY_ATTEMPTS',
  'SPECTATORS_FULL',
  'PLAYERS_FULL',
  'NOT_IN_LOBBY',
  'NOT_A_PLAYER',
  'SEAT_TAKEN',
  'SEAT_NOT_ALLOWED',
  'UNKNOWN_PERSONA',
  'INVALID_OPTIONS',
] as const;
export type RoomErrorCode = (typeof ROOM_ERROR_CODES)[number];

export interface RoomErrorMessage {
  readonly code: RoomErrorCode;
}
