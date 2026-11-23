import { gameEnvSchema, parseEnv } from '@31mus/shared';

import { createGameServer } from './server.js';

const env = parseEnv(gameEnvSchema, process.env);
const server = createGameServer();

server.listen(env.GAME_PORT, env.HOST, () => {
  console.log(`[game] escuchando en http://${env.HOST}:${String(env.GAME_PORT)}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`[game] ${signal} recibido, cerrando…`);
  server.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
