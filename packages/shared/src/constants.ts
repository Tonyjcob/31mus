// Constantes del producto (CLAUDE.md §5). Nada de números mágicos fuera de aquí.
// Las constantes de reglas del mus viven en `@31mus/engine` (`rules.ts`, ADR-0002).

/** Tiempo de turno por decisión (REGLAS_MUS.md §1). */
export const TURN_TIMEOUT_MS = 30_000;

/**
 * Retardo «humano» de los bots antes de actuar: un valor al azar en este rango. Lo aplica el
 * servidor, no el bot (HITOS H2, ADR-0003).
 */
export const BOT_DELAY_MIN_MS = 1_000;
export const BOT_DELAY_MAX_MS = 3_000;

/** Espectadores máximos por sala (CLAUDE.md §7). */
export const MAX_SPECTATORS = 5;

/** Interfaz y puertos por defecto en desarrollo (se pueden cambiar en `.env`). */
export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_API_PORT = 3000;
export const DEFAULT_GAME_PORT = 2567;
export const DEFAULT_WEB_PORT = 5173;

// --- Servidor de juego (H3, ADR-0004) ---

/** Pausa tras el fin de mano antes de repartir la siguiente; sin botón «listo» (D19). */
export const HAND_PAUSE_MS = 8_000;

/** Sin humanos conectados, la partida se pausa; pasado este tiempo, se cierra como abandonada (D20). */
export const EMPTY_ROOM_TIMEOUT_MS = 10 * 60_000;

/** Tiempo que la sala sigue abierta tras el fin de la partida, para ver el resultado. */
export const FINISHED_ROOM_LINGER_MS = 60_000;

/** Límite de frecuencia: como mucho `max` mensajes en una ventana deslizante de `windowMs`. */
export interface RateLimit {
  readonly max: number;
  readonly windowMs: number;
}

/** Chat común de jugadores y espectadores (CLAUDE.md §7, D21). */
export const CHAT_MAX_LENGTH = 200;
export const CHAT_RATE: RateLimit = { max: 5, windowMs: 10_000 };

/** Reacciones: lista cerrada mostrada como emojis flotantes (D21). */
export const REACTIONS = ['👏', '😂', '😮', '😡', '🔥', '👍', '👎', '🤔'] as const;
export type Reaction = (typeof REACTIONS)[number];
export const REACTION_RATE: RateLimit = { max: 3, windowMs: 5_000 };

/** Código de las salas privadas: sin 0/O/1/I/L para que no se confundan al dictarlo (D21). */
export const PRIVATE_CODE_LENGTH = 6;
export const PRIVATE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** Intentos fallidos de código por IP y sala; superado, se rechaza sin comparar (D21). */
export const PRIVATE_CODE_MAX_FAILS: RateLimit = { max: 5, windowMs: 60_000 };

/** Apodo visible en la mesa y en el chat. */
export const NICKNAME_MAX_LENGTH = 20;

/**
 * Cota de validación de la cantidad de un envite en los mensajes. La legalidad la decide el motor
 * (`MAX_BET`, ADR-0002); esto solo descarta números absurdos antes de llegar a él.
 */
export const MAX_ACTION_AMOUNT = 40;

/** Últimos `actionId` recordados por asiento para responder igual a un reenvío (idempotencia). */
export const ACTION_ID_MEMORY = 32;
