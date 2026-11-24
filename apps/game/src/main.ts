import { fileURLToPath } from 'node:url';

import { gameEnvSchema, parseEnv } from '@31mus/shared';

import { devIdentityVerifier } from './identity/dev-identity.js';
import { createLogger } from './infra/logger.js';
import { cryptoRng } from './infra/rng.js';
import { FileMatchLogStore } from './match-log/file-store.js';
import { createGameServer } from './server.js';

const env = parseEnv(gameEnvSchema, process.env);
const logger = createLogger({ level: env.LOG_LEVEL });
// Log de partidas en ficheros hasta H6 (Prisma): `apps/game/.data/match-logs/`, ignorado por git.
const matchLog = new FileMatchLogStore(
  fileURLToPath(new URL('../.data/match-logs/', import.meta.url)),
);
// Hasta H6 solo existe la identidad de desarrollo: en producción el servidor se niega a arrancar.
const server = createGameServer({
  production: env.NODE_ENV === 'production',
  identity: devIdentityVerifier,
  rng: cryptoRng,
  logger,
  matchLog,
});

await server.listen(env.GAME_PORT, env.HOST);
logger.info(`escuchando en ws://${env.HOST}:${String(env.GAME_PORT)}`);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'cerrando…');
  await server.gracefullyShutdown(false);
  await matchLog.idle(); // las salas cerradas registran sus partidas como abandonadas
  process.exit(0);
}

process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));
