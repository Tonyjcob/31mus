import { describe, expect, it } from 'vitest';

import { CHAT_MAX_LENGTH, NICKNAME_MAX_LENGTH, PRIVATE_CODE_ALPHABET } from '../constants.js';
import {
  chatTextSchema,
  nicknameSchema,
  personaIdSchema,
  privateCodeSchema,
  userIdSchema,
} from './text.js';

describe('chatTextSchema', () => {
  it('normaliza espacios y saltos de línea y recorta', () => {
    expect(chatTextSchema.parse('  hola\n\n  mesa\t ')).toBe('hola mesa');
  });

  it('admite emojis, también compuestos con ZWJ', () => {
    expect(chatTextSchema.parse('¡órdago! 🔥 👨‍👩‍👧')).toBe('¡órdago! 🔥 👨‍👩‍👧');
  });

  it('normaliza a NFC', () => {
    expect(chatTextSchema.parse('café')).toBe('café');
  });

  it('rechaza vacíos, demasiado largos, controles y texto bidireccional', () => {
    for (const text of [
      '',
      '   \n ',
      'a'.repeat(CHAT_MAX_LENGTH + 1),
      'hola\u0000',
      'hola\u0007',
      'abc‮def',
      'abc⁦def',
      'abc‏def',
      42,
    ]) {
      expect(chatTextSchema.safeParse(text).success).toBe(false);
    }
    expect(chatTextSchema.safeParse('a'.repeat(CHAT_MAX_LENGTH)).success).toBe(true);
  });

  it('no altera el HTML: se valida como texto y se pinta como texto', () => {
    expect(chatTextSchema.parse('<b>hola</b>')).toBe('<b>hola</b>');
  });
});

describe('nicknameSchema', () => {
  it('admite letras con tilde, eñe, números y _ . -', () => {
    for (const nickname of ['Antonio', 'Begoña_88', 'José M.', 'la-faraona']) {
      expect(nicknameSchema.parse(nickname)).toBe(nickname);
    }
    expect(nicknameSchema.parse('  Pepe   Luis ')).toBe('Pepe Luis');
  });

  it('rechaza símbolos, emojis, HTML y apodos demasiado largos', () => {
    for (const nickname of ['', '<script>', 'pepe🔥', 'a@b', 'x'.repeat(NICKNAME_MAX_LENGTH + 1)]) {
      expect(nicknameSchema.safeParse(nickname).success).toBe(false);
    }
  });
});

describe('userIdSchema y personaIdSchema', () => {
  it('validan identificadores opacos', () => {
    expect(userIdSchema.safeParse('user_123-abc').success).toBe(true);
    expect(userIdSchema.safeParse('').success).toBe(false);
    expect(userIdSchema.safeParse('a b').success).toBe(false);
    expect(userIdSchema.safeParse('x'.repeat(65)).success).toBe(false);
    expect(personaIdSchema.safeParse('faraona').success).toBe(true);
    expect(personaIdSchema.safeParse('Faraona').success).toBe(false);
    expect(personaIdSchema.safeParse('1abc').success).toBe(false);
  });
});

describe('privateCodeSchema', () => {
  it('pasa a mayúsculas y recorta', () => {
    expect(privateCodeSchema.parse(' abc234 ')).toBe('ABC234');
  });

  it('rechaza longitudes distintas de 6 y caracteres confundibles', () => {
    for (const code of [
      'ABC23',
      'ABC2345',
      'ABC20D',
      'ABCO2D',
      'ABC1DE',
      'ABCIDE',
      'ABCLDE',
      'AB-2DE',
    ]) {
      expect(privateCodeSchema.safeParse(code).success).toBe(false);
    }
  });

  it('el alfabeto no tiene caracteres confundibles ni repetidos', () => {
    expect(PRIVATE_CODE_ALPHABET).not.toMatch(/[01OIL]/);
    expect(new Set(PRIVATE_CODE_ALPHABET).size).toBe(PRIVATE_CODE_ALPHABET.length);
  });
});
