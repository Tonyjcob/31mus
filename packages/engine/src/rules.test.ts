import { describe, expect, it } from 'vitest';

import * as engine from './index.js';

// Comprueba los valores contra REGLAS_MUS.md: si cambian, cambia la especificación.
describe('constantes de reglas', () => {
  it('juego a 40 tantos y partida al mejor de 3 (§1)', () => {
    expect(engine.POINTS_TO_WIN_GAME).toBe(40);
    expect(engine.GAMES_TO_WIN_MATCH).toBe(2);
  });

  it('4 cartas por jugador, descarte de 1 a 4 y aviso de rebarajado bajo 16 (§3, D10)', () => {
    expect(engine.HAND_SIZE).toBe(4);
    expect(engine.MAX_DISCARD).toBe(engine.HAND_SIZE);
    expect(engine.RESHUFFLE_WARNING_THRESHOLD).toBe(16);
  });

  it('envites: envido 2, subida mínima 1, máximo 40, negada 1 (§5, D3, D13, D14)', () => {
    expect(engine.MIN_ENVIDO).toBe(2);
    expect(engine.MIN_REENVIDO).toBe(1);
    expect(engine.MAX_BET).toBe(40);
    expect(engine.NEGADA_POINTS).toBe(1);
  });

  it('valores del recuento (§4.3–4.5, §5.2)', () => {
    expect(engine.PASO_POINTS).toBe(1);
    expect(engine.PUNTO_POINTS).toBe(1);
    expect(engine.JUEGO_MIN).toBe(31);
    expect(engine.JUEGO_31_POINTS).toBe(3);
    expect(engine.JUEGO_POINTS).toBe(2);
    expect(engine.PARES_POINTS).toEqual({ pareja: 1, medias: 2, duples: 3 });
  });
});
