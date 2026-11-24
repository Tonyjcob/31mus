import { describe, expect, it } from 'vitest';

import { applyAction } from './apply-action.js';
import { createMatch, startNextHand } from './match.js';
import { createSeededRng } from './rng.js';
import { act, allPass, play, stateWith } from './testing/builders.js';
import { BASE } from './testing/scenarios.js';

const rng = createSeededRng(0);
const negadaMoves = [
  [0, act.corto],
  [0, act.envido(2)],
  [1, act.noQuiero],
  [3, act.noQuiero],
] as const;

describe('createMatch', () => {
  it('reparte 4 cartas a cada uno y abre el mus por la mano', () => {
    const state = createMatch({ firstMano: 2 }, createSeededRng(7));
    expect(state.mano).toBe(2);
    expect(state.hand.phase).toEqual({ kind: 'mus', turn: 2 });
    expect(state.hand.hands.every((h) => h.length === 4)).toBe(true);
    const all = [...state.hand.hands.flat(), ...state.hand.pile.deck];
    expect(new Set(all).size).toBe(40);
    expect(state).toMatchObject({ scores: [0, 0], gamesWon: [0, 0], gameNumber: 1 });
  });

  it('sortea la primera mano con el Rng y es reproducible con la misma semilla', () => {
    const manos = new Set(
      Array.from({ length: 40 }, (_, seed) => createMatch({}, createSeededRng(seed)).mano),
    );
    expect(manos).toEqual(new Set([0, 1, 2, 3]));
    expect(createMatch({}, createSeededRng(3))).toEqual(createMatch({}, createSeededRng(3)));
  });
});

describe('startNextHand', () => {
  it('no reparte si la mano no ha terminado', () => {
    const result = startNextHand(stateWith(BASE), { rng });
    expect(result.ok ? null : result.error.code).toBe('HAND_NOT_OVER');
  });

  it('la mano pasa al siguiente jugador y se conservan los tantos', () => {
    const ended = play(stateWith({ ...BASE, scores: [10, 12] }), [
      [0, act.corto],
      [0, act.ordago],
      [1, act.noQuiero],
      [3, act.noQuiero],
      ...allPass(0),
      [0, act.paso],
      [1, act.paso],
      [3, act.paso],
      [0, act.paso],
      [1, act.paso],
    ]).state;
    expect(ended.hand.phase.kind).toBe('handOver');
    const result = startNextHand(ended, { rng });
    if (!result.ok) throw new Error(result.error.code);
    const { state, events } = result.value;
    expect(state.mano).toBe(1);
    expect(state.hand.number).toBe(2);
    expect(state.scores).toEqual(ended.scores);
    expect(events[0]).toEqual({ type: 'handStarted', handNumber: 2, gameNumber: 1, mano: 1 });
    expect(events.filter((e) => e.type === 'cardsDealt').map((e) => e.seat)).toEqual([1, 2, 3, 0]);
  });

  it('tras ganar un juego, los tantos vuelven a 0 y sigue la rotación', () => {
    const ended = play(stateWith({ ...BASE, scores: [20, 39], mano: 3 }), [
      [3, act.corto],
      [3, act.envido(2)],
      [0, act.noQuiero],
      [2, act.noQuiero],
    ]).state;
    expect(ended.hand.phase).toEqual({ kind: 'handOver', gameWinner: 1 });
    const result = startNextHand(ended, { rng });
    if (!result.ok) throw new Error(result.error.code);
    expect(result.value.state).toMatchObject({
      mano: 0,
      scores: [0, 0],
      gamesWon: [0, 1],
      gameNumber: 2,
    });
  });
});

describe('fin de partida (al mejor de 3)', () => {
  const won = play(stateWith({ ...BASE, scores: [39, 0], gamesWon: [1, 1] }), negadaMoves);

  it('quien gana 2 juegos gana la partida', () => {
    expect(won.state.matchWinner).toBe(0);
    expect(won.state.gamesWon).toEqual([2, 1]);
    expect(won.events).toContainEqual({ type: 'matchWon', team: 0 });
  });

  it('con la partida terminada no se puede actuar ni repartir', () => {
    const action = applyAction(won.state, 0, act.mus, { rng });
    expect(action.ok ? null : action.error.code).toBe('MATCH_OVER');
    const next = startNextHand(won.state, { rng });
    expect(next.ok ? null : next.error.code).toBe('MATCH_OVER');
  });

  it('en una mano terminada nadie puede actuar', () => {
    const ended = play(stateWith({ ...BASE, scores: [39, 0] }), negadaMoves).state;
    const result = applyAction(ended, 0, act.mus, { rng });
    expect(result.ok ? null : result.error.code).toBe('NOT_YOUR_TURN');
  });
});
