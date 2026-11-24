import { describe, expect, it } from 'vitest';

import { applyAction } from '../apply-action.js';
import type { Action } from '../actions.js';
import { pendingSeats } from '../legal-actions.js';
import { createSeededRng } from '../rng.js';
import { act, everyone, play, stateWith } from '../testing/builders.js';
import { cards } from '../testing/notation.js';
import { BASE } from '../testing/scenarios.js';
import type { MatchState } from '../state.js';
import type { Seat } from '../seat.js';

const rng = createSeededRng(0);
const fourMus = (from: Seat) => everyone(act.mus, from);

function errorCode(state: MatchState, seat: Seat, action: Action) {
  const result = applyAction(state, seat, action, { rng });
  return result.ok ? null : result.error.code;
}

describe('fase de mus (D11)', () => {
  it('hablan por orden desde la mano', () => {
    const state = stateWith({ ...BASE, mano: 2 });
    expect(pendingSeats(state)).toEqual([2]);
    expect(errorCode(state, 0, act.mus)).toBe('NOT_YOUR_TURN');
    const next = play(state, [[2, act.mus]]).state;
    expect(pendingSeats(next)).toEqual([3]);
  });

  it('cualquiera puede cortar y la grande empieza siempre por la mano', () => {
    const { state, events } = play(stateWith(BASE), [
      [0, act.mus],
      [1, act.mus],
      [2, act.corto],
    ]);
    expect(state.hand.phase).toMatchObject({ kind: 'lance', lance: 'grande', turn: 0 });
    expect(events).toContainEqual({ type: 'musSpoken', seat: 2, choice: 'corto' });
  });

  it('si los cuatro dicen mus, descartan todos a la vez', () => {
    const { state } = play(stateWith({ ...BASE, mano: 2 }), fourMus(2));
    expect(state.hand.phase.kind).toBe('discard');
    expect(pendingSeats(state)).toEqual([0, 1, 2, 3]);
  });
});

describe('descarte', () => {
  const afterMus = play(stateWith(BASE), fourMus(0)).state;

  it('se descarta en cualquier orden y no se revela hasta que descartan los cuatro', () => {
    const { state, events } = play(afterMus, [
      [3, act.discard('1c')],
      [0, act.discard('1o Re')],
    ]);
    expect(pendingSeats(state)).toEqual([1, 2]);
    expect(events.map((e) => e.type)).toEqual(['discardSubmitted', 'discardSubmitted']);
    expect(state.hand.lastDiscardCounts).toBeNull();
    // Se guarda en el orden de la mano, no en el recibido.
    expect(state.hand.phase).toMatchObject({ discards: [cards('Re 1o'), null, null, cards('1c')] });
  });

  it('repone por orden desde la mano y vuelve al mus por la mano', () => {
    const { state, events } = play(afterMus, [
      [3, act.discard('1c')],
      [0, act.discard('Re 1o')],
      [2, act.discard('4c 5o 6o 7c')],
      [1, act.discard('Co')],
    ]);
    // Mazo por defecto: el resto de la baraja en orden; empieza por 3o So 2c 3c 6c Sc 1e 2e.
    expect(state.hand.hands).toEqual([
      cards('Ro Rc 3o So'),
      cards('Cc 7o 4o 2c'),
      cards('3c 6c Sc 1e'),
      cards('2o 4e 5c 2e'),
    ]);
    expect(state.hand.lastDiscardCounts).toEqual([2, 1, 4, 1]);
    expect(state.hand.pile.discards).toEqual(cards('Re 1o Co 4c 5o 6o 7c 1c'));
    expect(state.hand.pile.deck).toHaveLength(16);
    expect(state.hand.phase).toEqual({ kind: 'mus', turn: 0 });
    expect(events.map((e) => e.type).slice(-5)).toEqual([
      'discardsRevealed',
      'cardsDrawn',
      'cardsDrawn',
      'cardsDrawn',
      'cardsDrawn',
    ]);
  });

  it('rechaza descartes no válidos', () => {
    expect(errorCode(afterMus, 0, act.discard('Co'))).toBe('ILLEGAL_ACTION');
    expect(errorCode(afterMus, 0, { type: 'discard', cards: [] })).toBe('ILLEGAL_ACTION');
    expect(errorCode(afterMus, 0, act.discard('Re Re'))).toBe('ILLEGAL_ACTION');
    expect(errorCode(afterMus, 0, act.mus)).toBe('ILLEGAL_ACTION');
    const discarded = play(afterMus, [[0, act.discard('Re')]]).state;
    expect(errorCode(discarded, 0, act.discard('Ro'))).toBe('NOT_YOUR_TURN');
  });

  it('si el mazo no llega, reparte lo que queda y baraja todos los descartes (D10)', () => {
    const base = stateWith(BASE);
    const rest = base.hand.pile.deck;
    const short = stateWith({ ...BASE, deck: rest.slice(0, 2), discards: rest.slice(2) });
    const { state, events } = play(short, [
      ...fourMus(0),
      [0, act.discard('Ro Rc Re 1o')],
      [1, act.discard('Co Cc 7o 4o')],
      [2, act.discard('4c 5o 6o 7c')],
      [3, act.discard('1c 2o 4e 5c')],
    ]);
    expect(events).toContainEqual({ type: 'discardsReshuffled' });
    expect(state.hand.hands[0].slice(0, 2)).toEqual(rest.slice(0, 2));
    const all = [...state.hand.hands.flat(), ...state.hand.pile.deck, ...state.hand.pile.discards];
    expect(new Set(all).size).toBe(40);
    expect(state.hand.pile.discards).toEqual([]);
  });
});
