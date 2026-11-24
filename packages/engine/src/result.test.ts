import { describe, expect, it } from 'vitest';

import { MUS_ERROR_CODES, musError } from './errors.js';
import { err, ok } from './result.js';

describe('Result', () => {
  it('ok envuelve el valor', () => {
    expect(ok(3)).toEqual({ ok: true, value: 3 });
  });

  it('err envuelve el error de dominio', () => {
    const error = musError('NOT_YOUR_TURN', 'No es el turno de este asiento.');
    expect(err(error)).toEqual({ ok: false, error });
  });

  it('los códigos de error son únicos', () => {
    expect(new Set(MUS_ERROR_CODES).size).toBe(MUS_ERROR_CODES.length);
  });
});
