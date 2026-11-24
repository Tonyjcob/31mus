// IA de los bots y catálogo de personajes (ADR-0003). Solo depende de @31mus/engine y, como el
// motor, es determinista: el azar (faroles) se inyecta con un Rng y el retardo «humano» lo aplica
// el servidor.
export { randomAction } from './random.js';
export type { BotDecision, BotInput, BotPersona, BotStyle } from './types.js';
