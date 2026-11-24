// Quién está en la sala: jugadores y espectadores, con su identidad verificada. Un jugador sentado
// en una partida empezada cuya conexión cae sigue aquí como «caído» hasta que vuelve con la misma
// sesión (reconexión de Colyseus) o con otra nueva (reentrada por `userId`), D7.
import type { ClientRole } from '@31mus/shared';
import { CloseCode, Deferred, type Client } from '@colyseus/core';

import type { Identity } from '../identity/identity.js';

/** Lo que `onAuth` deja en `client.auth`. */
export interface ClientAuth {
  readonly identity: Identity;
  readonly role: ClientRole;
}

export type MusClient = Client<{ auth: ClientAuth }>;

export interface Participant extends ClientAuth {
  readonly client: MusClient;
  /** Conexión caída a la espera de reconexión; `cancel` renuncia a ella. */
  readonly dropped: { cancel(): void } | null;
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

  /** Participantes con la conexión abierta (los que reciben mensajes). */
  online(): Participant[] {
    return this.values().filter((p) => p.dropped === null);
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

  /** Registra al participante. Si el usuario ya estaba (otra pestaña, una conexión zombi o una
   * caída a la espera), cierra o abandona la sesión antigua sin que cuente como salida. */
  add(participant: Omit<Participant, 'dropped'>): void {
    for (const [sessionId, previous] of this.bySession) {
      if (previous.identity.userId !== participant.identity.userId) continue;
      this.bySession.delete(sessionId);
      this.superseded.add(sessionId);
      if (previous.dropped === null) previous.client.leave(CloseCode.CONSENTED);
      else previous.dropped.cancel();
    }
    this.bySession.set(participant.client.sessionId, { ...participant, dropped: null });
  }

  /**
   * La conexión de la sesión cayó: se le guarda el sitio mientras dure `reconnection` (la de
   * `allowReconnection`). Devuelve `false` si la sala ya no admite reconexiones (se está cerrando):
   * entonces la caída cuenta como salida. El rechazo de la reconexión lo resuelve `onLeave`.
   */
  hold(sessionId: string, reconnection: Deferred<MusClient> | Promise<never>): boolean {
    reconnection.catch(() => undefined);
    const participant = this.bySession.get(sessionId);
    if (participant === undefined || !(reconnection instanceof Deferred)) return false;
    const cancel = (): void => {
      (reconnection.reject as (reason: unknown) => void)(false);
    };
    this.bySession.set(sessionId, { ...participant, dropped: { cancel } });
    return true;
  }

  /** La sesión caída volvió con una conexión nueva. Devuelve el participante, o `null`. */
  reconnect(client: MusClient): Participant | null {
    const participant = this.bySession.get(client.sessionId);
    if (participant === undefined) return null;
    const back: Participant = { ...participant, client, dropped: null };
    this.bySession.set(client.sessionId, back);
    return back;
  }

  /** Quita la sesión. Devuelve el participante si su salida cuenta (no estaba sustituida). */
  remove(sessionId: string): Participant | null {
    const participant = this.bySession.get(sessionId);
    this.bySession.delete(sessionId);
    if (this.superseded.delete(sessionId)) return null;
    return participant ?? null;
  }
}
