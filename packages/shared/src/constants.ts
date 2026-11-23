// Constantes del producto (CLAUDE.md §5). Nada de números mágicos fuera de aquí.

/** Tiempo de turno por decisión (REGLAS_MUS.md §1). */
export const TURN_TIMEOUT_MS = 30_000;

/** Tantos para ganar un juego (REGLAS_MUS.md §1). */
export const POINTS_TO_WIN_GAME = 40;

/** Juegos para ganar la partida: al mejor de 3 (REGLAS_MUS.md §1). */
export const GAMES_TO_WIN_MATCH = 2;

/** Espectadores máximos por sala (CLAUDE.md §7). */
export const MAX_SPECTATORS = 5;

/** Interfaz y puertos por defecto en desarrollo (se pueden cambiar en `.env`). */
export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_API_PORT = 3000;
export const DEFAULT_GAME_PORT = 2567;
export const DEFAULT_WEB_PORT = 5173;
