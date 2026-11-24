// Límite de frecuencia en memoria con ventana deslizante (ADR-0004 §6). Un solo proceso en H3;
// pasa a Redis cuando haya varios (H7/H10).
import type { RateLimit } from '@31mus/shared';

import type { Scheduler } from './scheduler.js';

/** Claves que se recuerdan como mucho; al llegar, se olvidan las que ya no tienen eventos. */
const MAX_TRACKED_KEYS = 10_000;

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: RateLimit,
    private readonly scheduler: Pick<Scheduler, 'now'>,
  ) {}

  /** ¿Superaría el límite un evento más de `key` ahora? No registra nada. */
  isLimited(key: string): boolean {
    return this.recent(key).length >= this.limit.max;
  }

  /** Registra un evento de `key`. Devuelve `false` (y no lo registra) si supera el límite. */
  tryConsume(key: string): boolean {
    const recent = this.recent(key);
    if (recent.length >= this.limit.max) {
      return false;
    }
    recent.push(this.scheduler.now());
    this.hits.set(key, recent);
    return true;
  }

  /** Registra un evento aunque supere el límite (p. ej. un intento fallido de código). */
  record(key: string): void {
    const recent = this.recent(key);
    recent.push(this.scheduler.now());
    this.hits.set(key, recent);
  }

  private recent(key: string): number[] {
    const since = this.scheduler.now() - this.limit.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((at) => at > since);
    if (recent.length === 0) {
      this.hits.delete(key);
    }
    if (this.hits.size >= MAX_TRACKED_KEYS) {
      this.prune(since);
    }
    return recent;
  }

  private prune(since: number): void {
    for (const [key, times] of this.hits) {
      if (times.every((at) => at <= since)) {
        this.hits.delete(key);
      }
    }
  }
}
