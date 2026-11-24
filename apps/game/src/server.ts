// Servidor de juego: Colyseus con la sala de mus y `/health` (ADR-0004). Sustituye al `node:http`
// provisional de H0.
import { MUS_ROOM_NAME } from '@31mus/shared';
import {
  createEndpoint,
  createRouter,
  defineRoom,
  defineServer,
  type Server,
} from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { musRoomWith, type MusRoomDeps } from './rooms/mus-room.js';

const SERVICE = 'game';

export interface GameServerOptions extends MusRoomDeps {
  readonly production: boolean;
}

export function createGameServer(options: GameServerOptions): Server {
  if (options.production && options.identity.devOnly) {
    throw new Error('La identidad de desarrollo no se puede usar en producción (ADR-0004 §3).');
  }
  const health = createEndpoint('/health', { method: ['GET', 'HEAD'] }, (ctx) =>
    Promise.resolve(ctx.json({ status: 'ok', service: SERVICE })),
  );
  return defineServer({
    rooms: { [MUS_ROOM_NAME]: defineRoom(musRoomWith(options)) },
    routes: createRouter({ health }),
    transport: new WebSocketTransport(),
    logger: options.logger,
    greet: false,
    gracefullyShutdown: false,
  });
}
