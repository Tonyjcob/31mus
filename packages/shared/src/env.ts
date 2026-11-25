// Validación de variables de entorno con Zod (CLAUDE.md §5: toda entrada externa se valida).
// Este paquete no depende de Node: quien llama pasa `process.env` como origen.
import { z } from 'zod';

import {
  DEFAULT_API_PORT,
  DEFAULT_GAME_PORT,
  DEFAULT_HOST,
  DEFAULT_WEB_PORT,
} from './constants.js';

const MAX_TCP_PORT = 65_535;

/** `VAR=` (vacía) en un .env equivale a no definirla: se aplica el valor por defecto. */
function emptyAsUndefined(value: unknown): unknown {
  return value === '' ? undefined : value;
}

function portSchema(defaultPort: number) {
  return z.preprocess(
    emptyAsUndefined,
    z.coerce.number().int().min(1).max(MAX_TCP_PORT).default(defaultPort),
  );
}

/** Interfaz de escucha. En desarrollo, solo local; en Docker se usa `0.0.0.0`. */
const hostSchema = z.preprocess(emptyAsUndefined, z.string().min(1).default(DEFAULT_HOST));

export const apiEnvSchema = z.object({
  HOST: hostSchema,
  API_PORT: portSchema(DEFAULT_API_PORT),
});
export type ApiEnv = z.output<typeof apiEnvSchema>;

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export const gameEnvSchema = z.object({
  HOST: hostSchema,
  GAME_PORT: portSchema(DEFAULT_GAME_PORT),
  NODE_ENV: z.preprocess(emptyAsUndefined, z.enum(NODE_ENVS).default('development')),
  LOG_LEVEL: z.preprocess(emptyAsUndefined, z.enum(LOG_LEVELS).default('info')),
});
export type GameEnv = z.output<typeof gameEnvSchema>;

/** Servidor de desarrollo de Vite (lo lee `apps/web/vite.config.js`). */
export const webEnvSchema = z.object({
  HOST: hostSchema,
  WEB_PORT: portSchema(DEFAULT_WEB_PORT),
});
export type WebEnv = z.output<typeof webEnvSchema>;

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
