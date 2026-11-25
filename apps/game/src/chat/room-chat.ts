// Chat y reacciones de una sala (CLAUDE.md §7, ADR-0004 §6): un canal para jugadores y
// espectadores. Valida con Zod (texto saneado en `shared`), pone el autor desde la identidad del
// servidor y aplica el límite de frecuencia por usuario (sobrevive a reconexiones).
import { randomUUID } from 'node:crypto';

import {
  CHAT_RATE,
  REACTION_RATE,
  chatSendSchema,
  reactionSendSchema,
  type ChatMessage,
  type MessageAuthor,
  type ReactionMessage,
  type RoomErrorCode,
} from '@31mus/shared';

import { RateLimiter } from '../infra/rate-limiter.js';
import type { Scheduler } from '../infra/scheduler.js';

export type ChatOutcome<T> =
  { readonly ok: true; readonly message: T } | { readonly ok: false; readonly code: RoomErrorCode };

export class RoomChat {
  private readonly chatLimit: RateLimiter;
  private readonly reactionLimit: RateLimiter;

  constructor(
    private readonly scheduler: Pick<Scheduler, 'now'>,
    private readonly newId: () => string = randomUUID,
  ) {
    this.chatLimit = new RateLimiter(CHAT_RATE, scheduler);
    this.reactionLimit = new RateLimiter(REACTION_RATE, scheduler);
  }

  /** Mensaje de chat de `userId`, listo para difundir, o el motivo del rechazo. */
  message(userId: string, from: MessageAuthor, payload: unknown): ChatOutcome<ChatMessage> {
    const parsed = chatSendSchema.safeParse(payload);
    if (!parsed.success) return { ok: false, code: 'INVALID_MESSAGE' };
    if (!this.chatLimit.tryConsume(userId)) return { ok: false, code: 'RATE_LIMITED' };
    return {
      ok: true,
      message: { id: this.newId(), from, text: parsed.data.text, at: this.scheduler.now() },
    };
  }

  /** Reacción de `userId`, lista para difundir, o el motivo del rechazo. */
  reaction(userId: string, from: MessageAuthor, payload: unknown): ChatOutcome<ReactionMessage> {
    const parsed = reactionSendSchema.safeParse(payload);
    if (!parsed.success) return { ok: false, code: 'INVALID_MESSAGE' };
    if (!this.reactionLimit.tryConsume(userId)) return { ok: false, code: 'RATE_LIMITED' };
    return { ok: true, message: { from, emoji: parsed.data.emoji, at: this.scheduler.now() } };
  }
}
