// Reloj falso para los tests (ADR-0004 §2): el tiempo solo avanza con `advance`.
import type { Scheduler, TimerHandle } from '../infra/scheduler.js';

interface Timer {
  readonly at: number;
  readonly seq: number;
  readonly callback: () => void;
  cancelled: boolean;
}

export class FakeScheduler implements Scheduler {
  private time: number;
  private seq = 0;
  private timers: Timer[] = [];

  constructor(start = 0) {
    this.time = start;
  }

  now(): number {
    return this.time;
  }

  schedule(delayMs: number, callback: () => void): TimerHandle {
    const timer: Timer = { at: this.time + delayMs, seq: this.seq++, callback, cancelled: false };
    this.timers.push(timer);
    return {
      cancel: () => {
        timer.cancelled = true;
      },
    };
  }

  /** Temporizadores pendientes (sin cancelar). */
  pending(): number {
    return this.timers.filter((timer) => !timer.cancelled).length;
  }

  /** Avanza el reloj y ejecuta, en orden, lo que venza (también lo que se programe mientras). */
  advance(ms: number): void {
    const until = this.time + ms;
    for (;;) {
      this.timers = this.timers.filter((timer) => !timer.cancelled);
      const next = this.timers
        .filter((timer) => timer.at <= until)
        .sort((a, b) => a.at - b.at || a.seq - b.seq)[0];
      if (next === undefined) break;
      this.timers = this.timers.filter((timer) => timer !== next);
      this.time = next.at;
      next.callback();
    }
    this.time = until;
  }
}
