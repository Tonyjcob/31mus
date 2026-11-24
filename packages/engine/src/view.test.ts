import { describe, expect, it } from 'vitest';

import { sameAction } from './actions.js';
import { getEventView } from './events.js';
import type { GameEvent } from './events.js';
import { defined, first } from './invariant.js';
import { act, everyone, play, stateWith } from './testing/builders.js';
import { cards } from './testing/notation.js';
import { BASE } from './testing/scenarios.js';
import { getView } from './view.js';

const state = stateWith(BASE);
const fourMus = everyone(act.mus);

describe('getView (§9)', () => {
  it('cada jugador ve solo sus cartas; el espectador, ninguna', () => {
    expect(getView(state, 1).ownCards).toEqual(cards('Co Cc 7o 4o'));
    expect(getView(state, 'spectator').ownCards).toBeNull();
    expect(getView(state, 1).cardCounts).toEqual([4, 4, 4, 4]);
    const json = JSON.stringify(getView(state, 1));
    for (const card of [...state.hand.hands[0], ...state.hand.hands[2], ...state.hand.pile.deck]) {
      expect(json).not.toContain(`"${card}"`);
    }
  });

  it('en el descarte se ve quién ha descartado y el descarte propio, no el ajeno', () => {
    const discard = play(state, [...fourMus, [0, act.discard('Re')]]).state;
    expect(getView(discard, 0).ownDiscard).toEqual(cards('Re'));
    expect(getView(discard, 1).ownDiscard).toBeNull();
    expect(getView(discard, 1).phase).toEqual({
      kind: 'discard',
      done: [true, false, false, false],
    });
    expect(JSON.stringify(getView(discard, 1))).not.toContain('"espadas-12"');
  });

  it('aviso de rebarajado durante el mus si quedan menos de 16 cartas (D10)', () => {
    const deck = state.hand.pile.deck;
    const short = stateWith({ ...BASE, deck: deck.slice(0, 15), discards: deck.slice(15) });
    expect(getView(short, 'spectator').reshuffleWarning).toBe(true);
    expect(getView(stateWith({ ...BASE, deck: deck.slice(0, 16) }), 0).reshuffleWarning).toBe(
      false,
    );
    const cut = play(short, [[0, act.corto]]).state;
    expect(getView(cut, 0).reshuffleWarning).toBe(false);
  });

  it('al terminar la mano, los jugadores ven las cuatro manos; el espectador no (D16)', () => {
    expect(getView(state, 0).revealedHands).toBeNull();
    const ended = play(stateWith({ ...BASE, scores: [39, 0] }), [
      [0, act.corto],
      [0, act.envido(2)],
      [1, act.noQuiero],
      [3, act.noQuiero],
    ]).state;
    expect(getView(ended, 2).revealedHands).toEqual(ended.hand.hands);
    expect(getView(ended, 'spectator').revealedHands).toBeNull();
  });
});

describe('getEventView', () => {
  const dealt: GameEvent = { type: 'cardsDealt', seat: 1, cards: cards('Co Cc 7o 4o') };

  it('las cartas privadas solo llegan a su dueño', () => {
    expect(getEventView(dealt, 1)).toEqual(dealt);
    expect(getEventView(dealt, 0)).toEqual({ ...dealt, cards: null });
    expect(getEventView(dealt, 'spectator')).toEqual({ ...dealt, cards: null });
  });

  it('las manos enseñadas no llegan a los espectadores', () => {
    const revealed: GameEvent = { type: 'handRevealed', hands: state.hand.hands };
    expect(getEventView(revealed, 3)).toEqual(revealed);
    expect(getEventView(revealed, 'spectator')).toEqual({ type: 'handRevealed', hands: null });
  });

  it('ningún evento filtrado de una partida lleva cartas ajenas', () => {
    const { events } = play(state, [
      ...fourMus,
      [0, act.discard('Re')],
      [1, act.discard('Co')],
      [2, act.discard('4c')],
      [3, act.discard('1c')],
      [0, act.corto],
    ]);
    const others = new Set([
      ...state.hand.hands[0],
      ...state.hand.hands[1],
      ...state.hand.hands[3],
    ]);
    const json = JSON.stringify(events.map((e) => getEventView(e, 2)));
    for (const card of others) expect(json).not.toContain(`"${card}"`);
  });
});

describe('acciones e invariantes', () => {
  it('sameAction compara descartes como conjuntos y sin repetidas', () => {
    expect(sameAction(act.discard('Ro Rc'), act.discard('Rc Ro'))).toBe(true);
    expect(sameAction(act.discard('Ro Ro'), act.discard('Ro Rc'))).toBe(false);
    expect(sameAction(act.discard('Ro Rc'), act.discard('Ro Ro'))).toBe(false);
    expect(sameAction(act.discard('Ro'), act.mus)).toBe(false);
    expect(sameAction(act.envido(3), act.envido(3))).toBe(true);
    expect(sameAction(act.envido(3), act.reenvido(3))).toBe(false);
    expect(sameAction(act.quiero, act.quiero)).toBe(true);
  });

  it('first y defined fallan si se rompe un invariante', () => {
    expect(() => first([], 'lista vacía')).toThrow('Invariante roto: lista vacía.');
    expect(() => defined(null, 'nulo')).toThrow('Invariante roto: nulo.');
    expect(first([3], 'x')).toBe(3);
    expect(defined(0, 'x')).toBe(0);
  });
});
