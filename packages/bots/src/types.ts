/** Tipos públicos de los bots (ADR-0003 §1 y §4). */
import type { Action, PlayerView, Rng } from '@31mus/engine';

/** Estilo de juego de un personaje. Todos los valores están en [0, 1]; 0,5 es el término medio. */
export interface BotStyle {
  /** Tendencia a cortar el mus (alta: corta con manos más flojas). */
  readonly cutTendency: number;
  /** Ganas de envidar y subir con mano buena. */
  readonly aggression: number;
  /** Probabilidad de envidar o subir con mano floja. */
  readonly bluffRate: number;
  /** Propensión al órdago. */
  readonly ordagoPropensity: number;
  /** Fuerza de más que exige para querer una apuesta. */
  readonly caution: number;
}

export interface BotPersona {
  readonly id: string;
  /** Nombre que ve el jugador. */
  readonly name: string;
  /** Una línea en español sobre su forma de jugar. */
  readonly description: string;
  readonly style: BotStyle;
}

/** Lo que recibe el bot: lo mismo que vería un humano en su asiento, nunca el estado completo. */
export interface BotInput {
  readonly view: PlayerView;
  readonly legal: readonly Action[];
  readonly persona: BotPersona;
  readonly rng: Rng;
}

export interface BotDecision {
  readonly action: Action;
  /** `true` si es un envite, una subida o un órdago con mano floja: un farol. */
  readonly bluff: boolean;
}
