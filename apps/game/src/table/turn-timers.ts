// Turnos en curso (ADR-0004 §5): el plazo de 30 s de cada asiento pendiente con su acción por
// tiempo agotado y, si juega un bot, su retardo «humano» de 1 a 3 s.
import type { BotPersona } from '@31mus/bots';
import type { Rng, Seat } from '@31mus/engine';

import type { Scheduler, TimerHandle } from '../infra/scheduler.js';

interface Turn {
  readonly deadline: number;
  readonly timeout: TimerHandle;
  bot: TimerHandle | null;
}

export interface TurnTimersDeps {
  readonly scheduler: Scheduler;
  readonly rng: Rng;
  readonly turnMs: number;
  readonly botDelayMinMs: number;
  readonly botDelayMaxMs: number;
  onTimeout(seat: Seat): void;
  onBotTurn(seat: Seat, persona: BotPersona): void;
}

export class TurnTimers {
  private readonly turns = new Map<Seat, Turn>();

  constructor(private readonly deps: TurnTimersDeps) {}

  deadline(seat: Seat): number | null {
    return this.turns.get(seat)?.deadline ?? null;
  }

  /**
   * Deja armados exactamente los turnos de `pending`. Conserva el plazo de los que `keep` indique
   * (el descarte simultáneo: descartar uno no reinicia el reloj de los demás); el resto empieza de
   * cero con el tiempo completo. `botFor` dice qué personaje juega el asiento, si es un bot.
   */
  sync(
    pending: readonly Seat[],
    keep: (seat: Seat) => boolean,
    botFor: (seat: Seat) => BotPersona | null,
  ): void {
    for (const [seat, turn] of this.turns) {
      if (!pending.includes(seat) || !keep(seat)) this.cancel(seat, turn);
    }
    for (const seat of pending) {
      if (!this.turns.has(seat)) this.arm(seat, botFor(seat));
    }
  }

  /** Un bot pasa a jugar por un asiento con el turno abierto (su humano se fue). */
  botTookOver(seat: Seat, persona: BotPersona): void {
    const turn = this.turns.get(seat);
    // Si el humano vuelve con el bot ya pensando, el bot termina esa acción (CLAUDE.md §7).
    if (turn?.bot === null) turn.bot = this.scheduleBot(seat, persona);
  }

  clear(): void {
    for (const [seat, turn] of this.turns) this.cancel(seat, turn);
  }

  private arm(seat: Seat, persona: BotPersona | null): void {
    const { scheduler, turnMs } = this.deps;
    this.turns.set(seat, {
      deadline: scheduler.now() + turnMs,
      timeout: scheduler.schedule(turnMs, () => {
        this.deps.onTimeout(seat);
      }),
      bot: persona === null ? null : this.scheduleBot(seat, persona),
    });
  }

  private scheduleBot(seat: Seat, persona: BotPersona): TimerHandle {
    const { botDelayMinMs, botDelayMaxMs, rng, scheduler } = this.deps;
    const delay = botDelayMinMs + rng.nextInt(botDelayMaxMs - botDelayMinMs + 1);
    return scheduler.schedule(delay, () => {
      this.deps.onBotTurn(seat, persona);
    });
  }

  private cancel(seat: Seat, turn: Turn): void {
    turn.timeout.cancel();
    turn.bot?.cancel();
    this.turns.delete(seat);
  }
}
