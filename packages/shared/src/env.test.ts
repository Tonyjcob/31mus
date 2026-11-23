import { describe, expect, it } from 'vitest';

import { DEFAULT_API_PORT, DEFAULT_GAME_PORT, DEFAULT_HOST } from './constants.js';
import { apiEnvSchema, gameEnvSchema, parseEnv } from './env.js';

describe('parseEnv', () => {
  it('aplica la interfaz y los puertos por defecto si no hay variables', () => {
    expect(parseEnv(apiEnvSchema, {})).toEqual({ HOST: DEFAULT_HOST, API_PORT: DEFAULT_API_PORT });
    expect(parseEnv(gameEnvSchema, {})).toEqual({
      HOST: DEFAULT_HOST,
      GAME_PORT: DEFAULT_GAME_PORT,
    });
  });

  it('convierte el puerto de texto a número y respeta HOST', () => {
    expect(parseEnv(apiEnvSchema, { HOST: '0.0.0.0', API_PORT: '4000' })).toEqual({
      HOST: '0.0.0.0',
      API_PORT: 4000,
    });
  });

  it('rechaza un puerto fuera de rango sin revelar el valor', () => {
    const secretLooking = '99999';
    expect(() => parseEnv(apiEnvSchema, { API_PORT: secretLooking })).toThrow(/API_PORT/);
    expect(() => parseEnv(apiEnvSchema, { API_PORT: secretLooking })).not.toThrow(
      new RegExp(secretLooking),
    );
  });

  it('rechaza un puerto que no es un número', () => {
    expect(() => parseEnv(gameEnvSchema, { GAME_PORT: 'abc' })).toThrow(/GAME_PORT/);
  });

  it('rechaza un HOST vacío', () => {
    expect(() => parseEnv(gameEnvSchema, { HOST: '' })).toThrow(/HOST/);
  });
});
