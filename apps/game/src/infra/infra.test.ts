import { describe, expect, it } from 'vitest';

import { FakeScheduler } from '../testing/fake-scheduler.js';
import { RateLimiter } from './rate-limiter.js';
import { cryptoRng } from './rng.js';
import { clockScheduler, systemScheduler } from './scheduler.js';

describe('cryptoRng', () => {
  it('devuelve enteros en [0, bound) y cubre todo el rango', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) {
      const value = cryptoRng.nextInt(6);
      expect(Number.isInteger(value) && value >= 0 && value < 6).toBe(true);
      seen.add(value);
    }
    expect(seen.size).toBe(6);
  });
});

describe('RateLimiter', () => {
  it('admite max eventos por ventana y libera los antiguos', () => {
    const clock = new FakeScheduler();
    const limiter = new RateLimiter({ max: 3, windowMs: 1_000 }, clock);
    expect([1, 2, 3].map(() => limiter.tryConsume('a'))).toEqual([true, true, true]);
    expect(limiter.tryConsume('a')).toBe(false);
    expect(limiter.isLimited('a')).toBe(true);
    expect(limiter.tryConsume('b')).toBe(true);
    clock.advance(1_000);
    expect(limiter.isLimited('a')).toBe(false);
    expect(limiter.tryConsume('a')).toBe(true);
  });

  it('record cuenta aunque se supere el límite', () => {
    const clock = new FakeScheduler();
    const limiter = new RateLimiter({ max: 2, windowMs: 1_000 }, clock);
    for (let i = 0; i < 5; i++) limiter.record('ip');
    expect(limiter.isLimited('ip')).toBe(true);
    clock.advance(999);
    expect(limiter.isLimited('ip')).toBe(true);
    clock.advance(1);
    expect(limiter.isLimited('ip')).toBe(false);
  });

  it('olvida las claves sin eventos recientes cuando hay muchas', () => {
    const clock = new FakeScheduler();
    const limiter = new RateLimiter({ max: 1, windowMs: 10 }, clock);
    for (let i = 0; i < 10_001; i++) limiter.record(`k${String(i)}`);
    clock.advance(10);
    expect(limiter.tryConsume('nueva')).toBe(true);
    expect(limiter.isLimited('k0')).toBe(false);
  });
});

describe('schedulers', () => {
  it('systemScheduler programa y cancela con el reloj real', async () => {
    expect(Math.abs(systemScheduler.now() - Date.now())).toBeLessThan(50);
    let fired = 0;
    systemScheduler.schedule(1, () => fired++);
    systemScheduler.schedule(1, () => fired++).cancel();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fired).toBe(1);
  });

  it('clockScheduler delega en el reloj de la sala', () => {
    const delays: number[] = [];
    let cleared = false;
    let fired = false;
    const scheduler = clockScheduler({
      setTimeout: (callback, delayMs) => {
        delays.push(delayMs);
        callback();
        return {
          clear: () => {
            cleared = true;
          },
        };
      },
    });
    scheduler
      .schedule(30, () => {
        fired = true;
      })
      .cancel();
    expect(delays).toEqual([30]);
    expect(fired).toBe(true);
    expect(cleared).toBe(true);
    expect(Math.abs(scheduler.now() - Date.now())).toBeLessThan(50);
  });
});

describe('FakeScheduler', () => {
  it('ejecuta en orden de vencimiento y no ejecuta los cancelados', () => {
    const clock = new FakeScheduler(1_000);
    const order: string[] = [];
    clock.schedule(20, () => order.push('b'));
    clock.schedule(10, () => {
      order.push('a');
      clock.schedule(5, () => order.push('a2'));
    });
    clock.schedule(20, () => order.push('c'));
    clock.schedule(15, () => order.push('x')).cancel();
    clock.advance(20);
    expect(order).toEqual(['a', 'a2', 'b', 'c']);
    expect(clock.now()).toBe(1_020);
    expect(clock.pending()).toBe(0);
  });
});
