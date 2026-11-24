// Quién está conectado a la sala: jugadores y espectadores, con su identidad verificada.
import type { ClientRole } from '@31mus/shared';
import { CloseCode, type Client } from '@colyseus/core';

import type { Identity } from '../identity/identity.js';

/** Lo que `onAuth` deja en `client.auth`. */
export interface ClientAuth {
  readonly identity: Identity;
  readonly role: ClientRole;
}

export type MusClient = Client<{ auth: ClientAuth }>;

export interface Participant extends ClientAuth {
  readonly client: MusClient;
}

export class Participants {
  private readonly bySession = new Map<string, Participant>();
  /** Sesiones sustituidas por una conexión nueva del mismo usuario: su salida no cuenta. */
  private readonly superseded = new Set<string>();

  get(sessionId: string): Participant | undefined {
    return this.bySession.get(sessionId);
  }

  values(): Participant[] {
    return [...this.bySession.values()];
  }

  spectators(): number {
    return this.values().filter((p) => p.role === 'spectator').length;
  }

  /** Participantes que no son `userId` ni la sesión `ignore`. */
  others(userId: string, ignore?: string): Participant[] {
    return this.values().filter(
      (p) => p.client.sessionId !== ignore && p.identity.userId !== userId,
    );
  }

  isConnected(userId: string): boolean {
    return this.values().some((p) => p.identity.userId === userId);
  }

  /** Registra al participante. Si el usuario ya estaba conectado (otra pestaña o una conexión
   * zombi), cierra la sesión antigua sin que cuente como salida. */
  add(participant: Participant): void {
    for (const [sessionId, previous] of this.bySession) {
      if (previous.identity.userId !== participant.identity.userId) continue;
      this.bySession.delete(sessionId);
      this.superseded.add(sessionId);
      previous.client.leave(CloseCode.CONSENTED);
    }
    this.bySession.set(participant.client.sessionId, participant);
  }

  /** Quita la sesión. Devuelve el participante si su salida cuenta (no estaba sustituida). */
  remove(sessionId: string): Participant | null {
    const participant = this.bySession.get(sessionId);
    this.bySession.delete(sessionId);
    if (this.superseded.delete(sessionId)) return null;
    return participant ?? null;
  }
}
