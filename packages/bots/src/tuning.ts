/**
 * Constantes de ajuste del bot medio (ADR-0003 §3). Se calibran con la simulación
 * (`pnpm --filter @31mus/bots sim`) y los resultados se anotan en docs/bots/MEDICIONES.md.
 * Las probabilidades y umbrales están en [0, 1]: probabilidad de que la pareja gane el lance.
 */
import type { Range } from './odds.js';

/** Peso de cada lance en el valor de la mano (decisión de mus y descarte). */
export const VALUE_WEIGHTS = { grande: 0.3, chica: 0.2, pares: 0.25, juego: 0.25 } as const;
/** Sin juego, el punto vale menos que el juego en el valor de la mano. */
export const PUNTO_FACTOR = 0.5;

/** Corta el mus si el valor de la mano llega a este umbral (estilo neutro). */
export const CUT_THRESHOLD = 0.42;
/** Cuánto mueve el umbral de corte la tendencia a cortar del personaje (de 0 a 1). */
export const CUT_STYLE_SPREAD = 0.2;

/** Envida sin apuesta previa desde esta probabilidad (estilo neutro). */
export const BET_THRESHOLD = 0.66;
export const BET_STYLE_SPREAD = 0.2;
/** Tantos de más en el envite por cada punto de probabilidad por encima del umbral. */
export const AMOUNT_SCALE = 20;

/** Sube una apuesta desde esta probabilidad (estilo neutro). */
export const RAISE_THRESHOLD = 0.8;
/** Lo que sube cuando sube. */
export const RAISE_AMOUNT = 2;

/** Órdago desde esta probabilidad (estilo neutro). */
export const ORDAGO_THRESHOLD = 0.97;
export const ORDAGO_STYLE_SPREAD = 0.12;
/** Con la mano para órdago, probabilidad (por mil) de lanzarlo con `ordagoPropensity` = 1. */
export const ORDAGO_PER_MILLE = 600;
/** Quiere un órdago desde esta probabilidad (estilo neutro). */
export const ORDAGO_CALL_THRESHOLD = 0.65;

/** Margen sobre el punto de equilibrio para querer una apuesta (estilo neutro). */
export const CALL_MARGIN = 0.2;
/** Cuánto mueve la cautela del personaje el umbral para querer. */
export const CAUTION_SPREAD = 0.2;

/** Probabilidad máxima de farol (por mil) en cada ocasión, con `bluffRate` = 1. */
export const BLUFF_PER_MILLE = 150;
/** Al responder, el farol (subir con mano floja) es menos frecuente que al abrir. */
export const RAISE_BLUFF_FACTOR = 0.3;
export const PER_MILLE = 1000;

/** Desde estos tantos (de cualquiera de las dos parejas) el bot aprieta más. */
export const PRESSURE_FROM = 25;
/** Cuánto bajan los umbrales de envite y de subida con la presión máxima (a 40). */
export const PRESSURE_SHIFT = 0.1;
/** Cuánto baja el umbral de órdago con la presión máxima: menos, para que siga siendo raro. */
export const ORDAGO_PRESSURE_SHIFT = 0.04;

/** Lo que se supone de la mano de un rival que acaba de envidar o subir (puede ir de farol). */
export const RIVAL_BET: Range = { low: 0.62, high: 1 };
/** Lo que se supone del compañero según lo que ha hecho en el lance. */
export const PARTNER_PASSED: Range = { low: 0, high: 0.75 };
export const PARTNER_CALLED: Range = { low: 0.45, high: 1 };
export const PARTNER_FOLDED: Range = { low: 0, high: 0.6 };
