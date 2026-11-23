import { apiEnvSchema, parseEnv } from '@31mus/shared';

import { createApiServer } from './server.js';

const env = parseEnv(apiEnvSchema, process.env);
const server = createApiServer();

server.listen(env.API_PORT, env.HOST, () => {
  console.log(`[api] escuchando en http://${env.HOST}:${String(env.API_PORT)}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`[api] ${signal} recibido, cerrando…`);
  server.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
