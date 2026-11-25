// Texto para el cliente de consola (herramienta de desarrollo, ADR-0004 §8): cartas, acciones,
// eventos y la vista de la mesa desde el asiento de quien juega. Funciones puras.
import {
  cardRank,
  cardSuit,
  type Action,
  type Card,
  type GameEvent,
  type Seat,
} from '@31mus/engine';
import type { GameViewMessage } from '@31mus/shared';

const RANK_NAMES: Readonly<Record<number, string>> = {
  1: 'As',
  2: 'Dos (as)',
  3: 'Tres (rey)',
  10: 'Sota',
  11: 'Caballo',
  12: 'Rey',
};

export function formatCard(card: Card): string {
  const rank = cardRank(card);
  return `${RANK_NAMES[rank] ?? String(rank)} de ${cardSuit(card)}`;
}

export function formatCards(cards: readonly Card[]): string {
  return cards.map(formatCard).join(', ');
}

export function formatAction(action: Action): string {
  switch (action.type) {
    case 'mus':
      return 'mus';
    case 'corto':
      return 'corto';
    case 'discard':
      return `descarto ${formatCards(action.cards)}`;
    case 'paso':
      return 'paso';
    case 'envido':
      return action.amount === 2 ? 'envido' : `envido ${String(action.amount)}`;
    case 'reenvido':
      return `${String(action.amount)} más`;
    case 'quiero':
      return 'quiero';
    case 'noQuiero':
      return 'no quiero';
    case 'ordago':
      return '¡órdago!';
  }
}

/** Nombre de un asiento visto desde `me` (el siguiente asiento es «a la derecha», §6). */
export function seatLabel(seat: Seat, me: Seat | null, names: readonly string[]): string {
  const name = names[seat] ?? `asiento ${String(seat)}`;
  if (me === null) return name;
  const relative = ['tú', 'rival der.', 'compañero', 'rival izq.'][(seat - me + 4) % 4];
  return seat === me ? 'tú' : `${name} (${relative ?? ''})`;
}

/** Una línea por evento; `null` si no merece mostrarse. */
export function formatEvent(event: GameEvent, who: (seat: Seat) => string): string | null {
  switch (event.type) {
    case 'handStarted':
      return `— Mano ${String(event.handNumber)} (juego ${String(event.gameNumber)}), es mano ${who(event.mano)}`;
    case 'cardsDealt':
    case 'cardsDrawn':
      return event.cards === null ? null : `Recibes: ${formatCards(event.cards)}`;
    case 'musSpoken':
      return `${who(event.seat)}: ${event.choice}`;
    case 'discardSubmitted':
      return `${who(event.seat)} ha descartado`;
    case 'discardsRevealed':
      return `Descartes: ${event.counts.join(' / ')} cartas`;
    case 'discardsReshuffled':
      return 'Se barajan los descartes';
    case 'lanceStarted':
      return `· A ${event.lance}`;
    case 'betSpoken':
      return `${who(event.seat)}: ${formatAction(event.action)}`;
    case 'lanceClosed':
    case 'ordagoResolved':
    case 'handEnded':
      return null;
    case 'pointsScored':
      return `  Pareja ${String(event.team)} +${String(event.points)} (${event.lance}, ${event.reason})`;
    case 'gameWon':
      return `*** La pareja ${String(event.team)} gana el juego ${String(event.gameNumber)} ***`;
    case 'matchWon':
      return `##### La pareja ${String(event.team)} gana la partida #####`;
    case 'handRevealed':
      return event.hands
        .map((cards, seat) => `  ${who(seat as Seat)}: ${formatCards(cards)}`)
        .join('\n');
  }
}

/** Marcador, fase y cartas propias. */
export function formatView(message: GameViewMessage, who: (seat: Seat) => string): string {
  const { view, deadline, serverNow } = message;
  const lines = [
    `Marcador: ${view.scores.join(' - ')} | juegos ${view.gamesWon.join(' - ')} | mano ${String(view.handNumber)}`,
  ];
  const { phase } = view;
  if (phase.kind === 'lance') {
    const bet = phase.bet === null ? 'sin apuesta' : `apuesta ${String(phase.bet.total)}`;
    lines.push(`Lance: ${phase.lance} (${bet}), habla ${who(phase.turn)}`);
  } else if (phase.kind === 'mus') {
    lines.push(`Mus: habla ${who(phase.turn)}`);
  } else if (phase.kind === 'discard') {
    lines.push('Descarte');
  }
  if (view.ownCards !== null) {
    lines.push(
      `Tus cartas: ${view.ownCards.map((c, i) => `[${String(i + 1)}] ${formatCard(c)}`).join('  ')}`,
    );
  }
  if (deadline !== null) {
    lines.push(`Te quedan ${String(Math.max(0, Math.round((deadline - serverNow) / 1_000)))} s`);
  }
  return lines.join('\n');
}
