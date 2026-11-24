import { describe, expect, it } from 'vitest';

import { applyAction } from '../apply-action.js';
import { getLegalActions } from '../legal-actions.js';
import { createSeededRng } from '../rng.js';
import type { MatchState } from '../state.js';
import { act, allPass, play, stateWith } from '../testing/builders.js';
import type { Move } from '../testing/builders.js';
import { BASE } from '../testing/scenarios.js';

const rng = createSeededRng(0);
/** BASE con la mano cortada: grande, habla el 0. */
const grande = play(stateWith(BASE), [[0, act.corto]]).state;
const after = (moves: readonly Move[], from: MatchState = grande) => play(from, moves);

describe('lance sin apuesta', () => {
  it('todos pasan: grande en paso y empieza la chica por la mano', () => {
    const { state } = after(allPass(0));
    expect(state.hand.lances).toEqual([{ lance: 'grande', outcome: { kind: 'paso' } }]);
    expect(state.hand.phase).toMatchObject({ kind: 'lance', lance: 'chica', turn: 0 });
  });

  it('se puede pasar, envidar de 2 a 40 u ordagar', () => {
    const legal = getLegalActions(grande, 0);
    expect(legal).toContainEqual(act.paso);
    expect(legal).toContainEqual(act.envido(2));
    expect(legal).toContainEqual(act.envido(40));
    expect(legal).not.toContainEqual(act.envido(1));
    expect(legal).not.toContainEqual(act.envido(41));
    expect(legal).toContainEqual(act.ordago);
    expect(legal).not.toContainEqual(act.quiero);
  });
});

describe('quién responde (D12)', () => {
  it('responde el siguiente rival y después su compañero, aunque el primero quiera', () => {
    const envido = after([[0, act.envido(2)]]).state;
    expect(envido.hand.phase).toMatchObject({ turn: 1, bet: { team: 0, responders: [1, 3] } });
    const quiero = after([[1, act.quiero]], envido).state;
    expect(quiero.hand.phase).toMatchObject({ turn: 3, bet: { firstResponse: 'quiero' } });
  });

  it('el compañero de quien envidó no habla hasta que suban los rivales', () => {
    const envido = after([[0, act.envido(2)]]).state;
    expect(getLegalActions(envido, 2)).toEqual([]);
    const result = applyAction(envido, 2, act.reenvido(2), { rng });
    expect(result.ok ? null : result.error.code).toBe('NOT_YOUR_TURN');
    const quiero = after([[1, act.quiero]], envido).state;
    expect(getLegalActions(quiero, 2)).toEqual([]);
  });

  it('quiero > no quiero: basta con que uno de los dos quiera', () => {
    for (const [first, second] of [
      [act.quiero, act.noQuiero],
      [act.noQuiero, act.quiero],
      [act.quiero, act.quiero],
    ] as const) {
      const { state } = after([
        [0, act.envido(3)],
        [1, first],
        [3, second],
      ]);
      expect(state.hand.lances).toEqual([
        { lance: 'grande', outcome: { kind: 'querido', amount: 3 } },
      ]);
      expect(state.scores).toEqual([0, 0]);
    }
  });

  it('si los dos no quieren, la pareja que envidó cobra la negada en el momento (D13)', () => {
    const { state, events } = after([
      [0, act.envido(5)],
      [1, act.noQuiero],
      [3, act.noQuiero],
    ]);
    expect(state.scores).toEqual([1, 0]);
    expect(events).toContainEqual({
      type: 'pointsScored',
      team: 0,
      points: 1,
      lance: 'grande',
      reason: 'negada',
    });
    expect(state.hand.lances).toEqual([
      { lance: 'grande', outcome: { kind: 'rechazado', team: 0 } },
    ]);
    expect(state.hand.phase).toMatchObject({ lance: 'chica', turn: 0 });
  });

  it('si el primer rival sube, la palabra pasa a la otra pareja y su compañero no habla', () => {
    const { state } = after([
      [0, act.envido(2)],
      [1, act.reenvido(2)],
    ]);
    // Responde el siguiente en orden de juego tras quien subió: el 2, luego el 0.
    expect(state.hand.phase).toMatchObject({
      turn: 2,
      bet: { team: 1, total: 4, onReject: 2, raised: true, responders: [2, 0] },
    });
  });

  it('el compañero puede subir aunque el primero haya querido; rechazar la subida paga el deje', () => {
    const { state, events } = after([
      [0, act.envido(2)],
      [1, act.quiero],
      [3, act.reenvido(3)],
      [0, act.noQuiero],
      [2, act.noQuiero],
    ]);
    expect(state.scores).toEqual([0, 2]);
    expect(events).toContainEqual({
      type: 'pointsScored',
      team: 1,
      points: 2,
      lance: 'grande',
      reason: 'deje',
    });
  });
});

describe('apuesta máxima (D14) y órdago (§5.4)', () => {
  it('las subidas no pasan de 40 en total; con 40, solo queda el órdago', () => {
    const at38 = after([[0, act.envido(38)]]).state;
    expect(getLegalActions(at38, 1)).toContainEqual(act.reenvido(2));
    expect(getLegalActions(at38, 1)).not.toContainEqual(act.reenvido(3));
    const at40 = after([[0, act.envido(40)]]).state;
    expect(getLegalActions(at40, 1)).toEqual([act.quiero, act.noQuiero, act.ordago]);
  });

  it('ante un órdago solo se quiere o no se quiere', () => {
    const ordago = after([[0, act.ordago]]).state;
    expect(getLegalActions(ordago, 1)).toEqual([act.quiero, act.noQuiero]);
  });

  it('órdago aceptado: el ganador del lance gana el juego y la mano termina', () => {
    const { state, events } = after([
      [0, act.ordago],
      [1, act.noQuiero],
      [3, act.quiero],
    ]);
    expect(events).toContainEqual({ type: 'ordagoResolved', lance: 'grande', winner: 0 });
    expect(state.scores).toEqual([40, 0]);
    expect(state.gamesWon).toEqual([1, 0]);
    expect(state.hand.phase).toEqual({ kind: 'handOver', gameWinner: 0 });
    expect(state.hand.lances).toEqual([]);
    expect(events.map((e) => e.type).slice(-4)).toEqual([
      'pointsScored',
      'gameWon',
      'handRevealed',
      'handEnded',
    ]);
  });

  it('órdago rechazado: negada si es la primera apuesta, deje si es una subida', () => {
    const negada = after([
      [0, act.ordago],
      [1, act.noQuiero],
      [3, act.noQuiero],
    ]).state;
    expect(negada.scores).toEqual([1, 0]);
    const deje = after([
      [0, act.envido(5)],
      [1, act.ordago],
      [2, act.noQuiero],
      [0, act.noQuiero],
    ]).state;
    expect(deje.scores).toEqual([0, 5]);
  });
});

describe('pares y juego: solo hablan quienes tienen jugada (§4.3–4.4)', () => {
  const pares = after([...allPass(0), ...allPass(0)]).state;

  it('se declara y hablan solo los que tienen pares', () => {
    expect(pares.hand.declarations.pares).toEqual([true, true, false, true]);
    expect(pares.hand.phase).toMatchObject({ lance: 'pares', speakers: [0, 1, 3], turn: 0 });
  });

  it('si el compañero no tiene jugada, solo responde un rival', () => {
    const { state } = after(
      [
        [0, act.paso],
        [1, act.envido(2)],
        [0, act.noQuiero],
      ],
      pares,
    );
    expect(state.scores).toEqual([0, 1]);
    expect(state.hand.lances.at(-1)).toEqual({
      lance: 'pares',
      outcome: { kind: 'rechazado', team: 1 },
    });
    expect(state.hand.phase).toMatchObject({ lance: 'juego', speakers: [0, 1] });
  });
});
