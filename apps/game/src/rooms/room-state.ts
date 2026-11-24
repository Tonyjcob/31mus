// Estado sincronizado de la sala (ADR-0004 §1): SOLO datos públicos de la mesa. Nada que salga de
// `MatchState` entra aquí; la partida viaja en mensajes por cliente (`table/outbound.ts`).
import { schema, t, type SchemaType } from '@colyseus/schema';

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
