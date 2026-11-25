// Detector de fugas de información (CLAUDE.md §2.2 y §9, ADR-0004 §8). Recorre en orden TODO lo que
// recibió un cliente y busca cartas en el JSON serializado (no en campos concretos). Antes de que se
// enseñen las manos (`handRevealed`, D16–D17), un jugador solo puede ver cartas que tuvo él en esa
// mano y un espectador, ninguna. Lo que tuvo cada asiento sale del log del servidor.
import { SEATS, type Card, type PerSeat, type Viewer } from '@31mus/engine';
import { SERVER_MESSAGES, type GameEventsMessage, type GameViewMessage } from '@31mus/shared';

import type { StoredMatch } from '../match-log/memory-store.js';

const CARD_PATTERN = /\b(?:oros|copas|espadas|bastos)-(?:1[0-2]|[1-7])\b/g;

export function cardsIn(value: unknown): string[] {
  return JSON.stringify(value).match(CARD_PATTERN) ?? [];
}

/** Cartas que tuvo cada asiento en cada mano (repartidas y robadas tras descartar). */
export function cardsHeld(match: StoredMatch): Map<number, PerSeat<ReadonlySet<Card>>> {
  const byHand = new Map<number, PerSeat<ReadonlySet<Card>>>();
  for (const hand of match.hands) {
    const held = SEATS.map((seat) => new Set<Card>(hand.dealt[seat])) as unknown as PerSeat<
      Set<Card>
    >;
    for (const event of hand.steps.flatMap((step) => step.events)) {
      if (event.type === 'cardsDrawn' && event.cards !== null) {
        for (const card of event.cards) held[event.seat].add(card);
      }
    }
    byHand.set(hand.number, held);
  }
  return byHand;
}

export interface LeakReport {
  readonly leaks: readonly string[];
  /** Cartas propias vistas (para comprobar que el detector no pasa en vacío). */
  readonly ownCardsSeen: number;
}

export function findLeaks(
  received: readonly { readonly type: string; readonly payload: unknown }[],
  viewer: Viewer,
  held: Map<number, PerSeat<ReadonlySet<Card>>>,
): LeakReport {
  const leaks: string[] = [];
  let ownCardsSeen = 0;
  let hand = 0;
  let revealed = false;

  const check = (what: string, value: unknown): void => {
    if (revealed) return;
    for (const card of cardsIn(value)) {
      const own = viewer !== 'spectator' && held.get(hand)?.[viewer].has(card as Card) === true;
      if (own) ownCardsSeen++;
      else leaks.push(`${what} (mano ${String(hand)}): ${card}`);
    }
  };

  for (const { type, payload } of received) {
    if (type === SERVER_MESSAGES.events) {
      for (const event of (payload as GameEventsMessage).events) {
        if (event.type === 'handStarted') {
          hand = event.handNumber;
          revealed = false;
        }
        if (event.type === 'handRevealed') revealed = true;
        check(`evento ${event.type}`, event);
      }
    } else if (type === SERVER_MESSAGES.view) {
      const { view } = payload as GameViewMessage;
      if (view.handNumber !== hand) {
        hand = view.handNumber;
        revealed = false;
      }
      if (view.revealedHands !== null) revealed = true;
      check('vista', payload);
    } else {
      check(type, payload);
    }
  }
  return { leaks, ownCardsSeen };
}
