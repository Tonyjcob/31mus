import { describe, expect, it } from 'vitest';

import { act, everyone, play, stateWith } from './testing/builders.js';
import { cards } from './testing/notation.js';
import { BASE } from './testing/scenarios.js';
import { getTimeoutAction, timeoutDiscard } from './timeout.js';

describe('descarte por tiempo agotado (D15)', () => {
  it.each([
    ['Ro Rc 7o 4o', '4o', 'la primera que no forma pareja en el orden 4, 5, 6, 7…'],
    ['Ro Co So 1o', 'So', 'sin cuatros ni sietes: la sota'],
    ['1o 2c Ro Co', 'Co', 'el caballo va antes que el rey; los ases forman pareja'],
    ['7o 7c 7e Ro', 'Ro', 'el rey es la única que no forma jugada'],
    ['Ro 3c 4o 4c', '4o', 'todas forman jugada: la primera en el orden (un 4)'],
    ['3o 3c Ro Rc', '3o', 'cuatro reyes: la primera de la mano'],
  ])('%s → %s (%s)', (hand, expected) => {
    expect(timeoutDiscard(cards(hand))).toBe(cards(expected)[0]);
  });
});

describe('getTimeoutAction (§8)', () => {
  const state = stateWith(BASE);

  it('en el mus, "corto"; a quien no le toca, nada', () => {
    expect(getTimeoutAction(state, 0)).toEqual(act.corto);
    expect(getTimeoutAction(state, 1)).toBeNull();
  });

  it('en el descarte, una carta según D15', () => {
    const discard = play(state, everyone(act.mus)).state;
    expect(getTimeoutAction(discard, 2)).toEqual(act.discard('4c'));
  });

  it('sin apuesta, paso; ante una apuesta, no quiero; el compañero mantiene la respuesta', () => {
    const grande = play(state, [[0, act.corto]]).state;
    expect(getTimeoutAction(grande, 0)).toEqual(act.paso);
    const envido = play(grande, [[0, act.envido(2)]]).state;
    expect(getTimeoutAction(envido, 1)).toEqual(act.noQuiero);
    const quiso = play(envido, [[1, act.quiero]]).state;
    expect(getTimeoutAction(quiso, 3)).toEqual(act.quiero);
    const noQuiso = play(envido, [[1, act.noQuiero]]).state;
    expect(getTimeoutAction(noQuiso, 3)).toEqual(act.noQuiero);
  });

  it('con la mano terminada, nada', () => {
    const ended = play(stateWith({ ...BASE, scores: [39, 0] }), [
      [0, act.corto],
      [0, act.envido(2)],
      [1, act.noQuiero],
      [3, act.noQuiero],
    ]).state;
    expect(getTimeoutAction(ended, 0)).toBeNull();
  });
});
