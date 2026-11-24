import { createSeededRng } from '@31mus/engine';
import type { Action, PlayerView } from '@31mus/engine';
import { describe, expect, it } from 'vitest';

import { decideAction } from './decide.js';
import { BOT_PERSONAS, NEUTRAL_PERSONA } from './personas.js';
import { cards } from './testing/notation.js';
import { answerLegal, betOf, lancePhase, openingLegal, viewWith } from './testing/views.js';
import type { BotPersona, BotStyle } from './types.js';

const MUS_LEGAL: Action[] = [{ type: 'mus' }, { type: 'corto' }];

function persona(style: Partial<BotStyle>): BotPersona {
  return { ...NEUTRAL_PERSONA, style: { ...NEUTRAL_PERSONA.style, ...style } };
}

/** Sin faroles ni órdagos: decisiones sin azar. */
const STEADY = persona({ bluffRate: 0, ordagoPropensity: 0 });

function decide(view: PlayerView, legal: readonly Action[], who = STEADY, seed = 1) {
  return decideAction({ view, legal, persona: who, rng: createSeededRng(seed) });
}

const musView = (hand: string) => viewWith({ hand, phase: { kind: 'mus', turn: 0 } });

describe('mus', () => {
  it('corta con buena mano y pide mus con una mala', () => {
    expect(decide(musView('Ro Rc 3e Cb'), MUS_LEGAL).action).toEqual({ type: 'corto' });
    expect(decide(musView('4o 5c 6e Cb'), MUS_LEGAL).action).toEqual({ type: 'mus' });
  });

  it('quien tiende a cortar corta antes que quien tiende a pedir mus', () => {
    const hands = ['Ro Cc 7e 1b', 'Ro 7c 7e 4b', 'Ro Sc 6e 4b', 'Ro Rc 6e 5b'];
    const cuts = (who: BotPersona) =>
      hands.filter((h) => decide(musView(h), MUS_LEGAL, who).action.type === 'corto').length;
    expect(cuts(persona({ cutTendency: 1 }))).toBeGreaterThan(cuts(persona({ cutTendency: 0 })));
  });
});

describe('descarte', () => {
  const discardView = (hand: string) =>
    viewWith({ hand, phase: { kind: 'discard', done: [false, false, false, false] } });
  const options = (hand: string): Action[] => {
    const own = cards(hand);
    const subsets = Array.from({ length: 15 }, (_, i) =>
      own.filter((_, bit) => (i + 1) & (1 << bit)),
    );
    return subsets.map((discard) => ({ type: 'discard', cards: discard }));
  };

  it('se queda la pareja de reyes y tira lo demás', () => {
    const { action } = decide(discardView('Ro Rc 4e 5b'), options('Ro Rc 4e 5b'));
    expect(action).toEqual({ type: 'discard', cards: cards('4e 5b') });
  });

  it('con duples solo tira una carta, nunca una de las parejas buenas', () => {
    const { action } = decide(discardView('Ro Rc Ce Cb'), options('Ro Rc Ce Cb'));
    expect(action.type === 'discard' ? action.cards.length : 0).toBe(1);
  });
});

describe('hablar sin apuesta', () => {
  it('con la mejor grande siendo mano envida', () => {
    const view = viewWith({ hand: 'Ro Rc 3e 3b', phase: lancePhase('grande', 0) });
    expect(decide(view, openingLegal()).action.type).toBe('envido');
  });

  it('con mano floja y sin faroles pasa', () => {
    const view = viewWith({ hand: '1o 4c 5e 6b', phase: lancePhase('grande', 0) });
    expect(decide(view, openingLegal())).toEqual({ action: { type: 'paso' }, bluff: false });
  });

  it('con mano floja, quien va de farol a veces envida, y se cuenta como farol', () => {
    const view = viewWith({ hand: '1o 4c 5e 6b', phase: lancePhase('grande', 0) });
    const bluffer = persona({ bluffRate: 1, ordagoPropensity: 0 });
    const decisions = Array.from({ length: 200 }, (_, seed) =>
      decide(view, openingLegal(), bluffer, seed),
    );
    const bluffs = decisions.filter((d) => d.bluff);
    expect(bluffs.length).toBeGreaterThan(0);
    expect(bluffs.every((d) => d.action.type === 'envido')).toBe(true);
  });

  it('con la mano ganada, el que ordaga mucho lanza órdago a veces; el que no, nunca', () => {
    const view = viewWith({ hand: 'Ro Cc So 1b', phase: lancePhase('juego', 0) });
    const ordagos = (who: BotPersona) =>
      Array.from({ length: 100 }, (_, seed) => decide(view, openingLegal(), who, seed)).filter(
        (d) => d.action.type === 'ordago',
      ).length;
    expect(ordagos(persona({ ordagoPropensity: 1 }))).toBeGreaterThan(0);
    expect(ordagos(STEADY)).toBe(0);
  });

  it('cerca de 40 envida con manos con las que antes pasaba', () => {
    const hands = ['Ro Cc 7e 4b', 'Ro 7c 6e 5b', 'Co Sc 7e 6b', 'Ro So 5e 4b', 'Ro Cc 4e 1b'];
    const bets = (scores: [number, number]) =>
      hands.filter((hand) => {
        const view = viewWith({ hand, phase: lancePhase('grande', 0), scores });
        return decide(view, openingLegal()).action.type === 'envido';
      }).length;
    expect(bets([38, 0])).toBeGreaterThan(bets([0, 0]));
  });
});

describe('responder a una apuesta', () => {
  const answer = (hand: string, bet = betOf(), scores: [number, number] = [0, 0], who = STEADY) =>
    decide(
      viewWith({ hand, phase: lancePhase('grande', 0, { bet }), scores }),
      answerLegal(bet),
      who,
    ).action;

  it('con mano floja no quiere un envite de 10', () => {
    expect(answer('1o 4c 5e 6b', betOf({ total: 10 }))).toEqual({ type: 'noQuiero' });
  });

  it('con la mejor mano sube o quiere', () => {
    expect(['reenvido', 'quiero']).toContain(answer('Ro Rc 3e 3b', betOf({ total: 10 })).type);
  });

  it('quiere si no querer les da el juego a los rivales', () => {
    expect(answer('1o 4c 5e 6b', betOf({ total: 10, onReject: 1 }), [0, 39])).toEqual({
      type: 'quiero',
    });
  });

  it('el prudente no quiere lo que el atrevido sí quiere', () => {
    const bet = betOf({ total: 4 });
    const hands = ['Ro Cc 7e 4b', 'Ro Rc 6e 5b', 'Ro Cc Se 1b', 'Ro 7c 6e 5b', 'Ro Rc 4e 1b'];
    const calls = (caution: number) =>
      hands.filter(
        (h) => answer(h, bet, [0, 0], persona({ caution, bluffRate: 0 })).type !== 'noQuiero',
      ).length;
    expect(calls(0)).toBeGreaterThan(calls(1));
  });

  it('ante un órdago solo quiere con mano muy buena', () => {
    const ordago = betOf({ ordago: true, total: 2 });
    expect(answer('1o 4c 5e 6b', ordago)).toEqual({ type: 'noQuiero' });
    expect(answer('Ro Rc 3e 3b', ordago)).toEqual({ type: 'quiero' });
  });

  it('tiene en cuenta lo que respondió su compañero', () => {
    const hand = 'Ro Cc 6e 5b';
    const asSecond = (firstResponse: 'quiero' | 'noQuiero') =>
      viewWith({
        hand,
        seat: 2,
        phase: lancePhase('grande', 2, { bet: betOf({ total: 6, firstResponse }) }),
      });
    const legal = answerLegal(betOf({ total: 6 }));
    const strong = decide(asSecond('quiero'), legal).action.type;
    const weak = decide(asSecond('noQuiero'), legal).action.type;
    expect(strong === 'noQuiero' && weak !== 'noQuiero').toBe(false);
  });
});

describe('errores de uso', () => {
  it('un espectador o una mano terminada no deciden', () => {
    const spectator = { ...musView('Ro Rc 3e Cb'), viewer: 'spectator' as const };
    expect(() => decide(spectator, MUS_LEGAL)).toThrow(RangeError);
    const over = viewWith({ hand: 'Ro Rc 3e Cb', phase: { kind: 'handOver', gameWinner: null } });
    expect(() => decide(over, [])).toThrow(RangeError);
  });

  it('sin acciones legales del tipo que toca, o hablando en un lance que no juega, es un error', () => {
    const discard = viewWith({
      hand: 'Ro Rc 3e Cb',
      phase: { kind: 'discard', done: [false, false, false, false] },
    });
    expect(() => decide(discard, [])).toThrow(RangeError);
    expect(() => decide(musView('Ro Rc 3e Cb'), [])).toThrow(RangeError);
    const noPares = viewWith({ hand: 'Ro Cc 7e 4b', phase: lancePhase('pares', 0) });
    expect(() => decide(noPares, openingLegal())).toThrow(RangeError);
  });
});

describe('catálogo de personajes', () => {
  it('cinco personajes con id único, nombre, descripción y rasgos en [0, 1]', () => {
    expect(BOT_PERSONAS).toHaveLength(5);
    expect(new Set(BOT_PERSONAS.map((p) => p.id)).size).toBe(5);
    for (const { name, description, style } of BOT_PERSONAS) {
      expect(name.length).toBeGreaterThan(0);
      expect(description.length).toBeGreaterThan(0);
      for (const trait of Object.values(style)) {
        expect(trait).toBeGreaterThanOrEqual(0);
        expect(trait).toBeLessThanOrEqual(1);
      }
    }
    expect(BOT_PERSONAS).toContain(NEUTRAL_PERSONA);
  });
});
