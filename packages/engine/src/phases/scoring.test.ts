import { describe, expect, it } from 'vitest';

import type { GameEvent } from '../events.js';
import { act, allPass, play, stateWith } from '../testing/builders.js';
import type { Move, StateOptions } from '../testing/builders.js';
import { BASE, NADA, PUNTO } from '../testing/scenarios.js';

const scored = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === 'pointsScored' ? [[e.lance, e.team, e.points, e.reason]] : []));

function hand(options: StateOptions, moves: readonly Move[]) {
  return play(stateWith(options), [[0, act.corto], ...moves]);
}

describe('recuento (§6)', () => {
  it('todo en paso: grande y chica 1, pares y juego el valor de las jugadas, en orden', () => {
    const { state, events } = hand(BASE, [
      ...allPass(0),
      ...allPass(0),
      [0, act.paso],
      [1, act.paso],
      [3, act.paso],
      [0, act.paso],
      [1, act.paso],
    ]);
    expect(scored(events)).toEqual([
      ['grande', 0, 1, 'recuento'],
      ['chica', 1, 1, 'recuento'],
      ['pares', 0, 2, 'recuento'],
      ['juego', 0, 3, 'recuento'],
    ]);
    expect(state.scores).toEqual([6, 1]);
    expect(state.hand.phase).toEqual({ kind: 'handOver', gameWinner: null });
    expect(events.at(-2)).toEqual({ type: 'handRevealed', hands: state.hand.hands });
  });

  it('lo querido se suma a las jugadas del ganador', () => {
    const { state } = hand(BASE, [
      [0, act.envido(2)],
      [1, act.quiero],
      [3, act.noQuiero],
      ...allPass(0),
      [0, act.paso],
      [1, act.paso],
      [3, act.paso],
      [0, act.envido(4)],
      [1, act.quiero],
    ]);
    // Grande 2; chica 1 para la pareja 1; pares 2; juego 4 + 3.
    expect(state.scores).toEqual([2 + 2 + 7, 1]);
  });

  it('grande rechazada: solo la negada, sin tanto en paso en el recuento (D13)', () => {
    const { state, events } = hand(BASE, [
      [0, act.envido(2)],
      [1, act.noQuiero],
      [3, act.noQuiero],
      ...allPass(0),
      [0, act.paso],
      [1, act.paso],
      [3, act.paso],
      [0, act.paso],
      [1, act.paso],
    ]);
    expect(scored(events)).toEqual([
      ['grande', 0, 1, 'negada'],
      ['chica', 1, 1, 'recuento'],
      ['pares', 0, 2, 'recuento'],
      ['juego', 0, 3, 'recuento'],
    ]); // Negada 1 + pares 2 + juego 3 = 6; la grande no suma nada más.
    expect(state.scores).toEqual([6, 1]);
  });

  it('pares o juego rechazados: quien apostó cobra la negada y además sus jugadas (D2)', () => {
    const { events } = hand(BASE, [
      ...allPass(0),
      ...allPass(0),
      [0, act.paso],
      [1, act.envido(2)],
      [0, act.noQuiero],
      [0, act.envido(2)],
      [1, act.noQuiero],
    ]);
    expect(scored(events)).toEqual([
      ['pares', 1, 1, 'negada'],
      ['juego', 0, 1, 'negada'],
      ['grande', 0, 1, 'recuento'],
      ['chica', 1, 1, 'recuento'],
      // La pareja 1 cobra sus pares aunque la 0 tenía mejores: renunció al lance.
      ['pares', 1, 2, 'recuento'],
      ['juego', 0, 3, 'recuento'],
    ]);
  });

  it('punto: sin envite si solo una pareja tiene pares; el punto querido vale el envite + 1', () => {
    const { state, events } = hand(PUNTO, [
      ...allPass(0),
      ...allPass(0),
      [0, act.envido(2)],
      [1, act.quiero],
      [3, act.noQuiero],
    ]);
    expect(state.hand.lances.map((l) => [l.lance, l.outcome.kind])).toEqual([
      ['grande', 'paso'],
      ['chica', 'paso'],
      ['pares', 'sinEnvite'],
      ['punto', 'querido'],
    ]);
    expect(scored(events)).toEqual([
      ['grande', 0, 1, 'recuento'],
      ['chica', 1, 1, 'recuento'],
      ['pares', 0, 1, 'recuento'],
      ['punto', 1, 3, 'recuento'],
    ]);
  });

  it('punto en paso vale 1; si nadie tiene pares, el lance no se juega', () => {
    const { state, events } = hand(NADA, [...allPass(0), ...allPass(0), ...allPass(0)]);
    expect(state.hand.lances.map((l) => l.outcome.kind)).toEqual([
      'paso',
      'paso',
      'noJugado',
      'paso',
    ]);
    expect(scored(events).at(-1)).toEqual(['punto', 1, 1, 'recuento']);
  });
});

describe('cierre del juego a 40 (§6)', () => {
  it('en cuanto una pareja llega a 40 gana, y no se cuenta lo demás aunque el rival llegara', () => {
    const { state, events } = hand({ ...BASE, scores: [37, 39] }, [
      ...allPass(0),
      ...allPass(0),
      [0, act.paso],
      [1, act.paso],
      [3, act.paso],
      [0, act.paso],
      [1, act.paso],
    ]);
    // Grande: 38-39. Chica: 38-40 y gana la pareja 1; pares y juego no se cuentan.
    expect(state.scores).toEqual([38, 40]);
    expect(state.gamesWon).toEqual([0, 1]);
    expect(state.hand.phase).toEqual({ kind: 'handOver', gameWinner: 1 });
    expect(scored(events)).toHaveLength(2);
    expect(events).toContainEqual({ type: 'gameWon', team: 1, gameNumber: 1 });
  });

  it('una negada que llega a 40 cierra el juego en mitad de la mano', () => {
    const { state } = hand({ ...BASE, scores: [39, 0] }, [
      [0, act.envido(2)],
      [1, act.noQuiero],
      [3, act.noQuiero],
    ]);
    expect(state.scores).toEqual([40, 0]);
    expect(state.hand.phase).toEqual({ kind: 'handOver', gameWinner: 0 });
    expect(state.hand.lances).toEqual([]);
  });

  it('los tantos no pasan de 40, tampoco en el evento', () => {
    const { state, events } = hand({ ...BASE, scores: [35, 0] }, [
      [0, act.envido(10)],
      [1, act.quiero],
      [3, act.quiero],
      ...allPass(0),
      [0, act.paso],
      [1, act.paso],
      [3, act.paso],
      [0, act.paso],
      [1, act.paso],
    ]);
    expect(state.scores).toEqual([40, 0]);
    // Se querían 10 de grande, pero solo faltaban 5 para el 40.
    expect(scored(events)[0]).toEqual(['grande', 0, 5, 'recuento']);
  });
});
