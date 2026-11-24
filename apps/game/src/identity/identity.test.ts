import { createSeededRng } from '@31mus/engine';
import { PRIVATE_CODE_ALPHABET, PRIVATE_CODE_LENGTH } from '@31mus/shared';
import { describe, expect, it } from 'vitest';

import { codeMatches, generatePrivateCode } from '../private-code.js';
import { devIdentityVerifier } from './dev-identity.js';

describe('devIdentityVerifier', () => {
  it('acepta userId y apodo válidos y los normaliza', async () => {
    await expect(devIdentityVerifier.verify({ userId: 'u1', nickname: ' Ana ' })).resolves.toEqual({
      userId: 'u1',
      nickname: 'Ana',
      kind: 'guest',
    });
    expect(devIdentityVerifier.devOnly).toBe(true);
  });

  it('rechaza opciones sin identidad válida', async () => {
    for (const options of [undefined, null, {}, { userId: 'u1' }, { userId: '', nickname: 'A' }]) {
      await expect(devIdentityVerifier.verify(options)).resolves.toBeNull();
    }
  });
});

describe('código privado', () => {
  it('genera 6 caracteres del alfabeto sin confundibles', () => {
    const rng = createSeededRng(1);
    for (let i = 0; i < 200; i++) {
      const code = generatePrivateCode(rng);
      expect(code).toHaveLength(PRIVATE_CODE_LENGTH);
      expect(code).toMatch(new RegExp(`^[${PRIVATE_CODE_ALPHABET}]+$`));
    }
  });

  it('compara exacto, también con longitudes distintas o sin código', () => {
    expect(codeMatches('ABC234', 'ABC234')).toBe(true);
    expect(codeMatches('ABC234', 'ABC235')).toBe(false);
    expect(codeMatches('ABC234', 'ABC23')).toBe(false);
    expect(codeMatches('ABC234', undefined)).toBe(false);
  });
});
