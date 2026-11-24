/**
 * Catálogo de personajes (HITOS H2, ADR-0003 §4): el mismo bot medio con distinto estilo.
 * Los valores se calibran con la simulación (docs/bots/MEDICIONES.md).
 */
import type { BotPersona } from './types.js';

export const NEUTRAL_PERSONA: BotPersona = {
  id: 'neutro',
  name: 'Bot',
  description: 'Equilibrado. Sustituye a los jugadores que se desconectan.',
  style: { cutTendency: 0.5, aggression: 0.5, bluffRate: 0.5, ordagoPropensity: 0.5, caution: 0.5 },
};

export const BOT_PERSONAS: readonly BotPersona[] = [
  {
    id: 'abuelo',
    name: 'El Abuelo',
    description: 'Conservador. Casi nunca va de farol y solo quiere con jugada segura.',
    style: {
      cutTendency: 0.55,
      aggression: 0.3,
      bluffRate: 0.1,
      ordagoPropensity: 0.2,
      caution: 0.85,
    },
  },
  {
    id: 'faraona',
    name: 'La Faraona',
    description: 'Agresiva. Envida mucho y lanza órdagos con facilidad.',
    style: {
      cutTendency: 0.5,
      aggression: 0.85,
      bluffRate: 0.45,
      ordagoPropensity: 0.9,
      caution: 0.35,
    },
  },
  {
    id: 'pollo',
    name: 'El Pollo',
    description: 'Faroles constantes: envida fuerte con manos flojas.',
    style: {
      cutTendency: 0.5,
      aggression: 0.65,
      bluffRate: 0.9,
      ordagoPropensity: 0.45,
      caution: 0.5,
    },
  },
  {
    id: 'rosario',
    name: 'Doña Rosario',
    description: 'Paciente. Pide mus hasta encontrar mano; muy sólida en pares y juego.',
    style: {
      cutTendency: 0.15,
      aggression: 0.5,
      bluffRate: 0.2,
      ordagoPropensity: 0.3,
      caution: 0.6,
    },
  },
  NEUTRAL_PERSONA,
];
