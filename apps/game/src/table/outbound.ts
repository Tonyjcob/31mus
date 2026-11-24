// ÚNICO constructor de los mensajes de partida que salen del servidor (ADR-0004 §1). Todo pasa por
// `getView` y `getEventView` del motor, que filtran la información oculta para cada destinatario.
// Ningún otro módulo envía datos de la partida: así el test de fuga vigila un solo punto.
import {
  getEventView,
  getLegalActions,
  getView,
  type GameEvent,
  type MatchState,
  type PerSeat,
  type Viewer,
} from '@31mus/engine';
import type { GameEventsMessage, GameViewMessage } from '@31mus/shared';

/** Lo que el controlador publica tras cada cambio de la partida. */
export interface MatchSnapshot {
  readonly version: number;
  readonly state: MatchState;
  /** Eventos completos (sin filtrar) del último cambio. Nunca salen tal cual. */
  readonly events: readonly GameEvent[];
  /** Fin del turno de cada asiento pendiente (ms del servidor), o `null`. */
  readonly deadlines: PerSeat<number | null>;
  /** `false` en pausa o al terminar: nadie puede actuar. */
  readonly running: boolean;
}

export function buildViewMessage(
  snapshot: MatchSnapshot,
  viewer: Viewer,
  serverNow: number,
): GameViewMessage {
  const canAct = viewer !== 'spectator' && snapshot.running;
  return {
    version: snapshot.version,
    view: getView(snapshot.state, viewer),
    legal: canAct ? getLegalActions(snapshot.state, viewer) : [],
    deadline: canAct ? snapshot.deadlines[viewer] : null,
    serverNow,
  };
}

/** Eventos filtrados para `viewer`, o `null` si no ve ninguno (no se envía nada). */
export function buildEventsMessage(
  snapshot: MatchSnapshot,
  viewer: Viewer,
): GameEventsMessage | null {
  const events = snapshot.events
    .map((event) => getEventView(event, viewer))
    .filter((event): event is GameEvent => event !== null);
  return events.length === 0 ? null : { version: snapshot.version, events };
}
