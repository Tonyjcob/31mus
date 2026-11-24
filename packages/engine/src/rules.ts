// Constantes de las reglas del mus (REGLAS_MUS.md). Nada de números mágicos fuera de aquí
// (CLAUDE.md §5). Viven en el motor porque `engine` no puede importar `shared` (ADR-0002 §8).

/** Tantos para ganar un juego (§1). */
export const POINTS_TO_WIN_GAME = 40;

/** Juegos para ganar la partida: al mejor de 3 (§1). */
export const GAMES_TO_WIN_MATCH = 2;

/** Cartas por jugador (§3). */
export const HAND_SIZE = 4;

/** Máximo de cartas en un descarte (§3); el mínimo es 1. */
export const MAX_DISCARD = 4;

/** Con menos cartas en el mazo se avisa de que pueden barajarse los descartes (D10, §3). */
export const RESHUFFLE_WARNING_THRESHOLD = 16;

/** Apuesta total máxima en un lance; para más, órdago (D14, §5). */
export const MAX_BET = 40;

/** Envite mínimo: "envido" son 2 tantos (§5). */
export const MIN_ENVIDO = 2;

/** Subida mínima de un reenvido (D3, §5). */
export const MIN_REENVIDO = 1;

/** Tanto que cobra quien apostó si se rechaza la primera apuesta del lance (D13, §5.3). */
export const NEGADA_POINTS = 1;

/** Tanto de grande o chica en paso (§5.2). */
export const PASO_POINTS = 1;

/** Valor del punto en el recuento (§4.5). */
export const PUNTO_POINTS = 1;

/** Suma mínima para tener juego (§4.4). */
export const JUEGO_MIN = 31;

/** Valor de la 31 en el recuento (§4.4). */
export const JUEGO_31_POINTS = 3;

/** Valor de cualquier otro juego en el recuento (§4.4). */
export const JUEGO_POINTS = 2;

/** Valor de cada jugada de pares en el recuento (§4.3). */
export const PARES_POINTS = { pareja: 1, medias: 2, duples: 3 } as const;
