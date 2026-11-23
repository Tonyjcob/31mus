// Validación de variables de entorno con Zod (CLAUDE.md §5: toda entrada externa se valida).
// Este paquete no depende de Node: quien llama pasa `process.env` como origen.
import { z } from 'zod';

import { DEFAULT_API_PORT, DEFAULT_GAME_PORT, DEFAULT_HOST } from './constants.js';

const MAX_TCP_PORT = 65_535;

const portSchema = z.coerce.number().int().min(1).max(MAX_TCP_PORT);

/** Interfaz de escucha. En desarrollo, solo local; en Docker se usa `0.0.0.0`. */
const hostSchema = z.string().min(1).default(DEFAULT_HOST);

export const apiEnvSchema = z.object({
  HOST: hostSchema,
  API_PORT: portSchema.default(DEFAULT_API_PORT),
});
export type ApiEnv = z.output<typeof apiEnvSchema>;

export const gameEnvSchema = z.object({
  HOST: hostSchema,
  GAME_PORT: portSchema.default(DEFAULT_GAME_PORT),
});
export type GameEnv = z.output<typeof gameEnvSchema>;

export type EnvSource = Readonly<Record<string, string | undefined>>;

/**
 * Valida el entorno. Si falla, lanza un error que nombra las variables inválidas
 * pero **nunca** incluye sus valores (podrían ser secretos).
 */
export function parseEnv<TSchema extends z.ZodType>(
  schema: TSchema,
  source: EnvSource,
): z.output<TSchema> {
  const result = schema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(raíz)'}: ${issue.code}`)
    .join('; ');
  throw new Error(`Variables de entorno inválidas: ${details}`);
}
