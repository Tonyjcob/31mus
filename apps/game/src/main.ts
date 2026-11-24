import { gameEnvSchema, parseEnv } from '@31mus/shared';

import { devIdentityVerifier } from './identity/dev-identity.js';
import { createLogger } from './infra/logger.js';
import { cryptoRng } from './infra/rng.js';
import { createGameServer } from './server.js';

const env = parseEnv(gameEnvSchema, process.env);
const logger = createLogger({ level: env.LOG_LEVEL });
// Hasta H6 solo existe la identidad de desarrollo: en producción el servidor se niega a arrancar.
const server = createGameServer({
  production: env.NODE_ENV === 'production',
  identity: devIdentityVerifier,
  rng: cryptoRng,
  logger,
});

await server.listen(env.GAME_PORT, env.HOST);
logger.info(`escuchando en ws://${env.HOST}:${String(env.GAME_PORT)}`);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, 'cerrando…');
  await server.gracefullyShutdown(false);
  process.exit(0);
}

process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));
