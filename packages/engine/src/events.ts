/**
 * Eventos de la partida (ADR-0002 §3). Se generan con toda la información, que es lo que se
 * guarda en el log del servidor. Antes de enviarlos a un cliente se pasan por `getEventView`.
 */
import type { BetAction } from './actions.js';
import type { Card } from './cards.js';
import type { Lance } from './evaluators/lances.js';
import type { PerSeat, Seat, Team } from './seat.js';
import type { LanceOutcome } from './state.js';

export type PointsReason = 'negada' | 'deje' | 'ordago' | 'recuento';

export type GameEvent =
  | {
      readonly type: 'handStarted';
      readonly handNumber: number;
      readonly gameNumber: number;
      readonly mano: Seat;
    }
  /** Privado: `cards` es `null` para quien no es `seat`. */
  | { readonly type: 'cardsDealt'; readonly seat: Seat; readonly cards: readonly Card[] | null }
  | { readonly type: 'musSpoken'; readonly seat: Seat; readonly choice: 'mus' | 'corto' }
  /** Privado: los demás solo saben que `seat` ya descartó, no cuántas ni cuáles. */
  | {
      readonly type: 'discardSubmitted';
      readonly seat: Seat;
      readonly cards: readonly Card[] | null;
    }
  /** Cuando han descartado los cuatro: cuántas cartas descartó cada uno. */
  | { readonly type: 'discardsRevealed'; readonly counts: PerSeat<number> }
  | { readonly type: 'discardsReshuffled' }
  /** Privado: `cards` es `null` para quien no es `seat`. */
  | { readonly type: 'cardsDrawn'; readonly seat: Seat; readonly cards: readonly Card[] | null }
  | {
      readonly type: 'lanceStarted';
      readonly lance: Lance;
      readonly speakers: readonly Seat[];
      /** En pares y juego, quién tiene jugada (declaración pública, §4.3–4.4). */
      readonly declarations: PerSeat<boolean> | null;
    }
  | { readonly type: 'betSpoken'; readonly seat: Seat; readonly action: BetAction }
  | { readonly type: 'lanceClosed'; readonly lance: Lance; readonly outcome: LanceOutcome }
  | { readonly type: 'ordagoResolved'; readonly lance: Lance; readonly winner: Seat }
  | {
      readonly type: 'pointsScored';
      readonly team: Team;
      readonly points: number;
      readonly lance: Lance;
      readonly reason: PointsReason;
    }
  | { readonly type: 'gameWon'; readonly team: Team; readonly gameNumber: number }
  | { readonly type: 'matchWon'; readonly team: Team }
  /** Fin de mano: los cuatro enseñan sus cartas (D16); las ven jugadores y espectadores (D17). */
  | { readonly type: 'handRevealed'; readonly hands: PerSeat<readonly Card[]> }
  | { readonly type: 'handEnded' };

export type Viewer = Seat | 'spectator';

/**
 * Versión de un evento que puede ver `viewer`: tapa las cartas ajenas. Los espectadores no ven
 * ninguna carta salvo las enseñadas al final de la mano (D17).
 * Devuelve `null` si el evento no debe llegarle (hoy ninguno; se deja por contrato).
 */
export function getEventView(event: GameEvent, viewer: Viewer): GameEvent | null {
  switch (event.type) {
    case 'cardsDealt':
    case 'cardsDrawn':
    case 'discardSubmitted':
      return viewer === event.seat ? event : { ...event, cards: null };
    case 'handRevealed':
    case 'handStarted':
    case 'musSpoken':
    case 'discardsRevealed':
    case 'discardsReshuffled':
    case 'lanceStarted':
    case 'betSpoken':
    case 'lanceClosed':
    case 'ordagoResolved':
    case 'pointsScored':
    case 'gameWon':
    case 'matchWon':
    case 'handEnded':
      return event;
  }
}
