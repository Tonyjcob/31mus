// Asientos de una mesa y reglas de inicio por modo (CLAUDE.md §7, ADR-0004 §5). Sin Colyseus:
// la sala traduce mensajes a estas operaciones y refleja el resultado en su estado público.
import { BOT_PERSONAS, type BotPersona } from '@31mus/bots';
import { SEATS, partnerOf, teamOf, type PerSeat, type Rng, type Seat } from '@31mus/engine';
import type { BotChoice, RoomErrorCode, RoomMode } from '@31mus/shared';

export type SeatOccupant =
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'human';
      readonly userId: string;
      readonly nickname: string;
      /** Si no está conectado, juega por él un bot neutro hasta que vuelva (D7). */
      readonly connected: boolean;
    }
  | { readonly kind: 'bot'; readonly persona: BotPersona };

export type HumanOccupant = Extract<SeatOccupant, { kind: 'human' }>;

/** Humanos que tienen que estar sentados para empezar. */
export const HUMANS_REQUIRED: Readonly<Record<RoomMode, number>> = {
  solo: 1,
  duo_vs_bots: 2,
  '2v2': 4,
  ranked: 4,
};

const EMPTY: SeatOccupant = { kind: 'empty' };

/** Error de una operación del lobby, o `null` si se hizo. */
export type LobbyResult = RoomErrorCode | null;

export class Lobby {
  private seats: SeatOccupant[] = [EMPTY, EMPTY, EMPTY, EMPTY];
  private started = false;

  constructor(readonly mode: RoomMode) {}

  get isStarted(): boolean {
    return this.started;
  }

  get occupants(): PerSeat<SeatOccupant> {
    const [s0, s1, s2, s3] = this.seats as [SeatOccupant, SeatOccupant, SeatOccupant, SeatOccupant];
    return [s0, s1, s2, s3];
  }

  occupant(seat: Seat): SeatOccupant {
    return this.occupants[seat];
  }

  seatOf(userId: string): Seat | null {
    return SEATS.find((seat) => isHuman(this.occupant(seat), userId)) ?? null;
  }

  humansSeated(): number {
    return this.seats.filter((occupant) => occupant.kind === 'human').length;
  }

  /** Humanos conectados (D20: sin ninguno, la partida se pausa). */
  connectedHumans(): number {
    return this.seats.filter((occupant) => occupant.kind === 'human' && occupant.connected).length;
  }

  /** ¿Están ya todos los humanos que pide el modo? */
  isReady(): boolean {
    return !this.started && this.humansSeated() === HUMANS_REQUIRED[this.mode];
  }

  /** Sentarse (o cambiarse de asiento) antes de empezar. */
  takeSeat(userId: string, nickname: string, seat: Seat): LobbyResult {
    if (this.started) return 'NOT_IN_LOBBY';
    const current = this.seatOf(userId);
    if (current === seat) return null;
    if (this.occupant(seat).kind !== 'empty') return 'SEAT_TAKEN';
    if (!this.seatAllowed(seat, current)) return 'SEAT_NOT_ALLOWED';
    if (current !== null) this.set(current, EMPTY);
    this.set(seat, { kind: 'human', userId, nickname, connected: true });
    return null;
  }

  /** Levantarse antes de empezar. No hace nada si no estaba sentado. */
  leaveSeat(userId: string): LobbyResult {
    if (this.started) return 'NOT_IN_LOBBY';
    const current = this.seatOf(userId);
    if (current !== null) this.set(current, EMPTY);
    return null;
  }

  /**
   * Empieza: los asientos libres pasan a bots con los personajes elegidos y el resto sorteado, sin
   * repetir personaje en la mesa. Devuelve `UNKNOWN_PERSONA` si se eligió uno que no existe.
   */
  start(choice: BotChoice, rng: Rng): LobbyResult {
    if (!this.isReady()) return 'NOT_IN_LOBBY';
    const plan = this.botPlan(choice);
    const chosen = [...plan.values()].filter((id): id is string => id !== undefined);
    const personas = chosen.map((id) => BOT_PERSONAS.find((persona) => persona.id === id));
    if (personas.includes(undefined)) return 'UNKNOWN_PERSONA';
    const pool = BOT_PERSONAS.filter((persona) => !chosen.includes(persona.id));
    for (const [seat, id] of plan) {
      const persona =
        BOT_PERSONAS.find((candidate) => candidate.id === id) ??
        pool.splice(rng.nextInt(pool.length), 1)[0];
      /* v8 ignore next -- hay 4 personajes y como mucho 3 asientos de bot. */
      if (persona === undefined) throw new Error('No quedan personajes para los bots.');
      this.set(seat, { kind: 'bot', persona });
    }
    this.started = true;
    return null;
  }

  /** El humano de `userId` se desconecta o vuelve durante la partida (D7). */
  setConnected(userId: string, connected: boolean): void {
    const seat = this.seatOf(userId);
    const occupant = seat === null ? null : this.occupant(seat);
    if (seat !== null && occupant?.kind === 'human') {
      this.set(seat, { ...occupant, connected });
    }
  }

  /**
   * Asientos de bot y personaje elegido (o `undefined` si se sortea). El compañero solo existe en
   * `solo`; los rivales, en `solo` y `duo_vs_bots`, en orden de asiento.
   */
  private botPlan(choice: BotChoice): Map<Seat, string | undefined> {
    const plan = new Map<Seat, string | undefined>();
    const free = SEATS.filter((seat) => this.occupant(seat).kind === 'empty');
    const humanSeat = SEATS.find((seat) => this.occupant(seat).kind === 'human');
    /* v8 ignore next -- `isReady` garantiza al menos un humano. */
    if (humanSeat === undefined) return plan;
    const rivals = free.filter((seat) => teamOf(seat) !== teamOf(humanSeat));
    rivals.forEach((seat, index) => plan.set(seat, choice.rivals?.[index]));
    if (free.includes(partnerOf(humanSeat))) plan.set(partnerOf(humanSeat), choice.partner);
    return plan;
  }

  /** En `duo_vs_bots` los dos humanos van en la misma pareja (CLAUDE.md §7). */
  private seatAllowed(seat: Seat, current: Seat | null): boolean {
    if (this.mode === 'solo') return this.humansSeated() === 0 || current !== null;
    if (this.mode !== 'duo_vs_bots') return true;
    const other = SEATS.find((s) => s !== current && this.occupant(s).kind === 'human');
    return other === undefined || teamOf(other) === teamOf(seat);
  }

  private set(seat: Seat, occupant: SeatOccupant): void {
    this.seats[seat] = occupant;
  }
}

function isHuman(occupant: SeatOccupant, userId: string): occupant is HumanOccupant {
  return occupant.kind === 'human' && occupant.userId === userId;
}
