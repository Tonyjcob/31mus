// Textos que escribe una persona: apodos, chat y códigos de sala (ADR-0004 §6).
// Se normalizan y se rechaza lo que pueda confundir al mostrarlo (controles, texto bidireccional).
import { z } from 'zod';

import {
  CHAT_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  PRIVATE_CODE_ALPHABET,
  PRIVATE_CODE_LENGTH,
} from '../constants.js';

/**
 * Caracteres de control y de formato bidireccional: rompen la maquetación o permiten disfrazar
 * un texto (p. ej. invertir el orden de lo que se lee). El ZWJ de los emojis compuestos sí se admite.
 */
const FORBIDDEN_CHARS = /[\p{Cc}‎‏‪-‮⁦-⁩]/u;

/** Normaliza a NFC, junta los espacios en blanco (también saltos de línea) en uno y recorta. */
function normalizeText(value: string): string {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function humanText(maxLength: number) {
  return z
    .string()
    .transform(normalizeText)
    .pipe(
      z
        .string()
        .min(1)
        .max(maxLength)
        .refine((text) => !FORBIDDEN_CHARS.test(text), 'Caracteres no permitidos'),
    );
}

/** Mensaje de chat: 1–200 caracteres tras normalizar. Se pinta siempre como texto, nunca como HTML. */
export const chatTextSchema = humanText(CHAT_MAX_LENGTH);

/** Apodo: letras, números, espacio y `_ . -`. */
export const nicknameSchema = humanText(NICKNAME_MAX_LENGTH).refine(
  (nickname) => /^[\p{L}\p{N} _.-]+$/u.test(nickname),
  'Apodo no válido',
);

/** Identificador de usuario (opaco). En H6 lo emite la API dentro del ticket de juego. */
export const userIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** Identificador de un personaje de bot; el servidor lo comprueba contra el catálogo de `bots`. */
export const personaIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);

const PRIVATE_CODE_PATTERN = new RegExp(`^[${PRIVATE_CODE_ALPHABET}]+$`);

/** Código de sala privada. Se admite en minúsculas y con espacios alrededor. */
export const privateCodeSchema = z
  .string()
  .transform((code) => code.trim().toUpperCase())
  .pipe(z.string().length(PRIVATE_CODE_LENGTH).regex(PRIVATE_CODE_PATTERN, 'Código no válido'));
