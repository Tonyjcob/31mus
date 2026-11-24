/**
 * Manos de referencia para los tests de fases. Resultados calculados a mano con REGLAS_MUS.md.
 */
import type { StateOptions } from './builders.js';

/**
 * Mano 0. Grande: J0 (tres reyes). Chica: J3 (dos ases). Pares: hablan 0, 1 y 3; gana J0
 * (medias de reyes, 2) y su pareja cobra 2. Juego: hablan 0 y 1, los dos con 31; gana J0 por
 * mano y su pareja cobra 3. Todo en paso: pareja 0 = 1 + 2 + 3 = 6, pareja 1 = 1.
 */
export const BASE: StateOptions = {
  hands: ['Ro Rc Re 1o', 'Co Cc 7o 4o', '4c 5o 6o 7c', '1c 2o 4e 5c'],
  mano: 0,
};

/**
 * Mano 0, nadie tiene juego: se juega al punto. Grande: J0. Chica: J3. Pares: solo J2 (pareja
 * de seises) → sin envite, la pareja 0 cobra 1. Punto: J1 (29), pareja 1.
 */
export const PUNTO: StateOptions = {
  hands: ['Ro Co 7o 2o', 'Rc Cc 5o 4o', 'So 6o 6c 4c', 'Sc 7c 5c 1o'],
  mano: 0,
};

/** Mano 0, nadie tiene pares ni juego (27, 29, 23, 27): el punto lo gana J1. */
export const NADA: StateOptions = {
  hands: ['Ro Co 6o 1o', 'Rc So 5o 4o', 'Sc 7o 5c 1c', 'Ce 7c 6c 4c'],
  mano: 0,
};
