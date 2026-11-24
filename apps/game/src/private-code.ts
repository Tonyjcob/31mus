// Código de las salas privadas (CLAUDE.md §7, D21).
import { timingSafeEqual } from 'node:crypto';

import type { Rng } from '@31mus/engine';
import { PRIVATE_CODE_ALPHABET, PRIVATE_CODE_LENGTH } from '@31mus/shared';

export function generatePrivateCode(rng: Rng): string {
  let code = '';
  for (let i = 0; i < PRIVATE_CODE_LENGTH; i++) {
    code += PRIVATE_CODE_ALPHABET.charAt(rng.nextInt(PRIVATE_CODE_ALPHABET.length));
  }
  return code;
}

/** Compara en tiempo constante: el tiempo de respuesta no revela cuántos caracteres acertó. */
export function codeMatches(expected: string, given: string | undefined): boolean {
  if (given === undefined) {
    return false;
  }
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
