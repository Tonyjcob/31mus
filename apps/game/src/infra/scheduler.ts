// Tiempo inyectable (ADR-0004 §2): la lógica de la mesa no lee el reloj ni programa temporizadores
// por su cuenta, así que en los tests se sustituye por un reloj falso y no hay que esperar.

export interface TimerHandle {
  cancel(): void;
}

export interface Scheduler {
  /** Milisegundos desde epoch. */
  now(): number;
  /** Ejecuta `callback` dentro de `delayMs`. Cancelar un temporizador ya ejecutado no hace nada. */
  schedule(delayMs: number, callback: () => void): TimerHandle;
}

/** Reloj real con `setTimeout` de Node (para lo que no vive dentro de una sala). */
export const systemScheduler: Scheduler = {
  now: () => Date.now(),
  schedule(delayMs, callback) {
    const timer = setTimeout(callback, delayMs);
    return {
      cancel: () => {
        clearTimeout(timer);
      },
    };
  },
};

/** Lo mínimo del `Clock` de Colyseus que se usa: así la sala programa con su propio reloj. */
interface ClockLike {
  setTimeout(callback: () => void, delayMs: number): { clear(): void };
}

/** Reloj de una sala de Colyseus: sus temporizadores se cancelan solos al cerrar la sala. */
export function clockScheduler(clock: ClockLike): Scheduler {
  return {
    now: () => Date.now(),
    schedule(delayMs, callback) {
      const delayed = clock.setTimeout(callback, delayMs);
      return {
        cancel: () => {
          delayed.clear();
        },
      };
    },
  };
}
