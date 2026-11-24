// Juega una partida entera sin intervención (herramienta de desarrollo, H3): un cliente real del SDK
// crea una sala `solo` y juega como el bot neutro con lo que le manda el servidor.
//   pnpm --filter @31mus/game play:script                  # servidor propio con tiempos cortos
//   pnpm --filter @31mus/game play:script --url ws://127.0.0.1:2567   # contra `pnpm dev` (lento)
//   Opciones: --seed N (decisiones del jugador), --verbose (todos los eventos), --timeout S.
// El log de la partida queda en `apps/game/.data/match-logs/`. Termina con código 0 si la partida
// acaba con ganador; 1 si no.
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { NEUTRAL_PERSONA, decideAction } from '@31mus/bots';
import { createSeededRng } from '@31mus/engine';
import { DEFAULT_GAME_PORT } from '@31mus/shared';

import { devIdentityVerifier } from '../identity/dev-identity.js';
import { createLogger } from '../infra/logger.js';
import { cryptoRng } from '../infra/rng.js';
import { FileMatchLogStore } from '../match-log/file-store.js';
import { createGameServer } from '../server.js';
import { CliRoom, scriptArgs } from './cli-room.js';

const { values } = parseArgs({
  args: scriptArgs(),
  options: {
    url: { type: 'string' },
    seed: { type: 'string', default: '1' },
    verbose: { type: 'boolean', default: false },
    timeout: { type: 'string', default: '120' },
  },
});

/** Puerto del servidor propio: junto al de desarrollo, sin chocar con él. */
const SCRIPT_PORT = DEFAULT_GAME_PORT + 1;
/** Tiempos cortos para que la partida dure segundos (el flujo es el mismo de producción). */
const FAST_TIMING = {
  turnMs: 5_000,
  botDelayMinMs: 1,
  botDelayMaxMs: 5,
  handPauseMs: 20,
  emptyRoomMs: 5_000,
  finishedLingerMs: 200,
};

const matchLog = new FileMatchLogStore(
  fileURLToPath(new URL('../../.data/match-logs/', import.meta.url)),
);
const server =
  values.url === undefined
    ? createGameServer({
        production: false,
        identity: devIdentityVerifier,
        rng: cryptoRng,
        logger: createLogger({ level: 'warn' }),
        matchLog,
        timing: FAST_TIMING,
      })
    : null;
if (server !== null) await server.listen(SCRIPT_PORT, '127.0.0.1');
const url = values.url ?? `ws://127.0.0.1:${String(SCRIPT_PORT)}`;

const rng = createSeededRng(Number(values.seed));
const startedAt = Date.now();
let hands = 0;

async function finish(code: number): Promise<never> {
  if (server !== null) await server.gracefullyShutdown(false);
  await matchLog.idle();
  process.exit(code);
}

const room = await CliRoom.open(
  url,
  { userId: 'script', nickname: 'script' },
  { kind: 'create', options: { mode: 'solo' } },
  (line) => {
    if (line.startsWith('— Mano')) hands++;
    if (values.verbose || line.includes('gana')) console.log(line);
  },
  {
    // Juega como el bot neutro, solo con la vista y las acciones legales que recibe.
    onView: ({ view, legal }) => {
      if (legal.length === 0) return;
      room.act(decideAction({ view, legal, persona: NEUTRAL_PERSONA, rng }).action);
    },
    onLeave: () => {
      const seconds = ((Date.now() - startedAt) / 1_000).toFixed(1);
      const winner = room.matchWinner;
      console.log(
        winner === null
          ? `La sala se cerró sin ganador tras ${String(hands)} manos.`
          : `Partida terminada: gana la pareja ${String(winner)} en ${String(hands)} manos (${seconds} s).`,
      );
      if (server !== null) console.log('Log de la partida en apps/game/.data/match-logs/');
      void finish(winner === null ? 1 : 0);
    },
  },
);

console.log(`Jugando en ${url} (sala ${room.room.roomId})…`);
setTimeout(
  () => {
    console.error(`Tiempo agotado (${values.timeout} s).`);
    void finish(1);
  },
  Number(values.timeout) * 1_000,
).unref();
