// Estado sincronizado de la sala (ADR-0004 §1): SOLO datos públicos de la mesa. Nada que salga de
// `MatchState` entra aquí; la partida viaja en mensajes por cliente (`table/outbound.ts`).
import { schema, t, type SchemaType } from '@colyseus/schema';

import type { SeatOccupant } from '../table/lobby.js';

export const SeatState = schema(
  {
    /** `empty` | `human` | `bot`. */
    kind: t.string(),
    nickname: t.string(),
    /** Personaje si es un bot; vacío si no. */
    personaId: t.string(),
    /** Humano conectado. Si no, juega por él un bot neutro (D7). */
    connected: t.boolean(),
  },
  'SeatState',
);
export type SeatState = SchemaType<typeof SeatState>;

export const MusRoomState = schema(
  {
    mode: t.string(),
    visibility: t.string(),
    /** `lobby` | `playing` | `paused` | `finished`. */
    status: t.string(),
    seats: t.array(SeatState),
    spectators: t.uint8(),
  },
  'MusRoomState',
);
export type MusRoomState = SchemaType<typeof MusRoomState>;

/** Campos públicos de un asiento: apodo o nombre del personaje, nunca nada de la partida. */
export function seatFields(occupant: SeatOccupant) {
  return {
    kind: occupant.kind,
    nickname:
      occupant.kind === 'human'
        ? occupant.nickname
        : occupant.kind === 'bot'
          ? occupant.persona.name
          : '',
    personaId: occupant.kind === 'bot' ? occupant.persona.id : '',
    connected: occupant.kind === 'human' ? occupant.connected : occupant.kind === 'bot',
  };
}
