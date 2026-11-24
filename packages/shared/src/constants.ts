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
