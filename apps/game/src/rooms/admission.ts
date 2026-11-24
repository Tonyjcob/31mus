// Quién puede entrar en una sala (CLAUDE.md §7, ADR-0004 §6): código privado con límite de
// intentos fallidos (D21), plazas de jugador según el modo, espectadores (máx. 5) y vuelta al
// asiento propio durante toda la partida (D7).
import type { Rng } from '@31mus/engine';
import {
  MAX_SPECTATORS,
  PRIVATE_CODE_MAX_FAILS,
  type ClientRole,
  type RoomErrorCode,
} from '@31mus/shared';

import { RateLimiter } from '../infra/rate-limiter.js';
import type { Scheduler } from '../infra/scheduler.js';
import { codeMatches, generatePrivateCode } from '../private-code.js';
import { HUMANS_REQUIRED, type Lobby } from '../table/lobby.js';
import type { Participants } from './participants.js';

export interface AdmissionDeps {
  readonly lobby: Lobby;
  readonly participants: Participants;
  readonly scheduler: Scheduler;
  readonly rng: Rng;
  readonly isPrivate: boolean;
  readonly creatorUserId: string;
}

export class Admission {
  /** Código de la sala privada, o `null` si es pública. */
  readonly code: string | null;
  private readonly failures: RateLimiter;

  constructor(private readonly deps: AdmissionDeps) {
    this.code = deps.isPrivate ? generatePrivateCode(deps.rng) : null;
    this.failures = new RateLimiter(PRIVATE_CODE_MAX_FAILS, deps.scheduler);
  }

  /**
   * Comprueba el código de una sala privada. Quien ya forma parte de la sala (creador, sentado o
   * conectado) no lo necesita. Superado el límite de fallos de una IP, se rechaza sin comparar.
   */
  checkCode(userId: string, ip: string, given: string | undefined): RoomErrorCode | null {
    if (this.code === null || this.knows(userId)) return null;
    if (this.failures.isLimited(ip)) return 'TOO_MANY_ATTEMPTS';
    if (codeMatches(this.code, given)) return null;
    this.failures.record(ip);
    return 'WRONG_CODE';
  }

  /** Motivo para no admitir a alguien, o `null`. `ignore` es la sesión que se está uniendo. */
  refusal(userId: string, role: ClientRole, ignore?: string): RoomErrorCode | null {
    const { lobby, participants } = this.deps;
    const others = participants.others(userId, ignore);
    if (role === 'spectator') {
      const spectators = others.filter((p) => p.role === 'spectator').length;
      return spectators >= MAX_SPECTATORS ? 'SPECTATORS_FULL' : null;
    }
    if (lobby.seatOf(userId) !== null) return null; // vuelve a su asiento (D7)
    if (lobby.isStarted) return 'NOT_IN_LOBBY';
    const players = others.filter((p) => p.role === 'player').length;
    return players >= HUMANS_REQUIRED[lobby.mode] ? 'PLAYERS_FULL' : null;
  }

  private knows(userId: string): boolean {
    return (
      userId === this.deps.creatorUserId ||
      this.deps.lobby.seatOf(userId) !== null ||
      this.deps.participants.isConnected(userId)
    );
  }
}
