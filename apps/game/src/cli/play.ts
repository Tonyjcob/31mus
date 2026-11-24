// Cliente de consola para jugar contra el servidor de juego (herramienta de desarrollo, H3).
//   pnpm --filter @31mus/game play                       # partida solo contra bots
//   pnpm --filter @31mus/game play --name Ana --mode 2v2 --private
//   pnpm --filter @31mus/game play --join <roomId> [--code ABC234] [--spectate]
// Durante la partida: un número, «e N» (envite) o «d 1 3» (descarte); /chat texto, /r 👏,
// /sentar N, /levantar, /salir.
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

import {
  CLIENT_MESSAGES,
  REACTIONS,
  CASUAL_MODES,
  gameEnvSchema,
  nicknameSchema,
  parseEnv,
  type GameViewMessage,
} from '@31mus/shared';

import { CliRoom, scriptArgs, type CliTarget } from './cli-room.js';
import { formatView } from './format.js';
import { buildMenu, describeMenu, parseChoice } from './menu.js';

const HELP = `Órdenes: número, «e N», «d 1 3» · /chat texto · /r ${REACTIONS.join(' ')} · /sentar N · /levantar · /salir`;

const { values } = parseArgs({
  args: scriptArgs(),
  options: {
    url: { type: 'string' },
    name: { type: 'string', default: 'yo' },
    mode: { type: 'string', default: 'solo' },
    private: { type: 'boolean', default: false },
    join: { type: 'string' },
    code: { type: 'string' },
    spectate: { type: 'boolean', default: false },
  },
});

const env = parseEnv(gameEnvSchema, process.env);
const url = values.url ?? `ws://${env.HOST}:${String(env.GAME_PORT)}`;
const nickname = nicknameSchema.parse(values.name);
const mode = CASUAL_MODES.find((m) => m === values.mode);
if (mode === undefined)
  throw new Error(`Modo desconocido: ${values.mode}. Usa ${CASUAL_MODES.join(', ')}.`);
const target: CliTarget =
  values.join === undefined
    ? { kind: 'create', options: { mode, visibility: values.private ? 'private' : 'public' } }
    : {
        kind: 'join',
        roomId: values.join,
        role: values.spectate ? 'spectator' : 'player',
        ...(values.code === undefined ? {} : { code: values.code }),
      };

const out = (line: string): void => {
  console.log(line);
};
const input = createInterface({ input: process.stdin, output: process.stdout });

let shownHand = 0;

/** Muestra la mesa al empezar cada mano y cuando nos toca; el resto lo narran los eventos. */
function showTurn(view: GameViewMessage, room: CliRoom): void {
  const newHand = view.view.handNumber !== shownHand;
  if (!newHand && view.legal.length === 0) return;
  shownHand = view.view.handNumber;
  out('');
  out(formatView(view, room.who));
  if (view.legal.length > 0) out(describeMenu(buildMenu(view.legal)));
}

const room = await CliRoom.open(
  url,
  { userId: `cli-${randomUUID().slice(0, 8)}`, nickname },
  target,
  out,
  {
    onView: (view) => {
      showTurn(view, room);
    },
    onLeave: (code) => {
      out(`Fin de la conexión (código ${String(code)}).`);
      input.close();
      process.exit(0);
    },
  },
);

out(`Sala ${room.room.roomId} en ${url}. ${HELP}`);
setTimeout(() => {
  if (room.code !== null) out(`Código de la sala privada: ${room.code}`);
}, 300);

input.on('line', (line) => {
  const text = line.trim();
  if (text === '') return;
  const [command = '', ...rest] = text.split(/\s+/);
  const arg = rest.join(' ');
  switch (command) {
    case '/salir':
      void room.leave();
      return;
    case '/chat':
      room.send(CLIENT_MESSAGES.chat, { text: arg });
      return;
    case '/r':
      room.send(CLIENT_MESSAGES.reaction, { emoji: arg });
      return;
    case '/sentar':
      room.send(CLIENT_MESSAGES.takeSeat, { seat: Number(arg) });
      return;
    case '/levantar':
      room.send(CLIENT_MESSAGES.leaveSeat, {});
      return;
    default:
      break; // no es una orden: es una jugada
  }
  const view = room.lastView;
  if (view === null || view.legal.length === 0) {
    out(`Ahora no te toca. ${HELP}`);
    return;
  }
  const choice = parseChoice(text, view.legal, view.view.ownCards);
  if (choice.ok) room.act(choice.action);
  else out(choice.error);
});
