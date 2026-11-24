import { describe, expect, it } from 'vitest';

import { lanceShare, lanceStats } from './strength.js';
import { cards } from './testing/notation.js';

const stats = (lance: Parameters<typeof lanceStats>[0], hand: string) =>
  lanceStats(lance, cards(hand));

describe('tablas de fuerza', () => {
  it('cuatro reyes son la mejor grande: solo empatan con otros cuatro reyes', () => {
    const best = stats('grande', 'Ro Rc 3e 3b');
    expect(best?.beat).toBeCloseTo(1 - (best?.tie ?? 0), 10);
    expect(best?.tie).toBeGreaterThan(0);
  });

  it('cuatro ases son la mejor chica y la peor grande', () => {
    expect(stats('chica', '1o 1c 2e 2b')?.beat).toBeCloseTo(
      1 - (stats('chica', '1o 1c 2e 2b')?.tie ?? 0),
      10,
    );
    expect(stats('grande', '1o 1c 2e 2b')?.beat).toBe(0);
  });

  it('duples de reyes son los mejores pares y la mano sin pares no juega', () => {
    const duples = stats('pares', 'Ro Rc 3e 3b');
    expect(duples?.beat).toBeCloseTo(1 - (duples?.tie ?? 0), 10);
    expect(stats('pares', 'Ro Cc 7e 4b')).toBeNull();
    expect(stats('pares', 'Ro Rc 7e 4b')?.beat ?? 1).toBeLessThan(duples?.beat ?? 0);
  });

  it('el juego sigue el orden 31 > 32 > 40 > 37 > 33 y una mano sin juego no lo juega', () => {
    // 31, 32, 40, 37 y 33.
    const order = ['Ro Cc So 1b', 'Ro Rc 7e 5b', 'Ro Rc Ce Sb', 'Ro Cc 7o Sb', 'Ro Cc 7o 6b'];
    const beats = order.map((hand) => stats('juego', hand)?.beat ?? -1);
    const best = stats('juego', 'Ro Cc So 1b');
    expect(best?.beat).toBeCloseTo(1 - (best?.tie ?? 0), 10);
    for (let i = 1; i < beats.length; i++) {
      expect(beats[i]).toBeLessThan(beats[i - 1] ?? 0);
    }
    expect(beats.at(-1)).toBe(0);
    expect(stats('juego', '4o 5c 6e 7b')).toBeNull();
  });

  it('al punto solo juegan las manos sin juego; 30 es el mejor punto', () => {
    expect(stats('punto', 'Ro Cc So 1b')).toBeNull();
    const treinta = stats('punto', 'Ro Rc 6e 4b');
    expect((treinta?.beat ?? 0) + (treinta?.tie ?? 0)).toBeCloseTo(1, 10);
    expect(stats('punto', '1o 1c 2e 2b')?.beat).toBe(0); // 4, el peor punto
  });

  it('las fuerzas están en [0, 1] y la fracción de manos con jugada es razonable', () => {
    expect(lanceShare('grande')).toBe(1);
    expect(lanceShare('pares')).toBeGreaterThan(0.3);
    expect(lanceShare('pares')).toBeLessThan(0.8);
    expect(lanceShare('juego') + lanceShare('punto')).toBeCloseTo(1, 10);
  });
});
