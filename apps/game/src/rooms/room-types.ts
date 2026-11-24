// Tipos de la sala de mus y rechazo al unirse.
import type { Rng } from '@31mus/engine';
import type { RoomErrorCode, RoomMode, RoomStatus, RoomVisibility } from '@31mus/shared';
import { ErrorCode, ServerError } from '@colyseus/core';

import type { IdentityVerifier } from '../identity/identity.js';
import type { Logger } from '../infra/logger.js';
import type { TableTiming } from '../table/table-session.js';

/** Dependencias que inyecta el servidor (nunca vienen del cliente). */
export interface MusRoomDeps {
  readonly identity: IdentityVerifier;
  readonly rng: Rng;
  readonly logger: Logger;
  /** Tiempos de la mesa; los tests los acortan. */
  readonly timing?: Partial<TableTiming>;
}

/** Metadatos de la sala para el listado (CLAUDE.md §7). */
export interface MusRoomMetadata {
  readonly mode: RoomMode;
  readonly visibility: RoomVisibility;
  readonly hasCode: boolean;
  readonly seatsTaken: number;
  readonly spectators: number;
  readonly status: RoomStatus;
}

/** Rechazo al unirse: el cliente recibe el código de error en el mensaje. */
export function reject(code: RoomErrorCode): ServerError {
  return new ServerError(ErrorCode.AUTH_FAILED, code);
}
