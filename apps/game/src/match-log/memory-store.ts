// Log de partidas en memoria: para tests y para inspeccionar lo registrado.
import type { HandRecord, MatchLogStore, MatchMeta, MatchResult } from './match-log.js';

export interface StoredMatch {
  readonly meta: MatchMeta;
  readonly hands: HandRecord[];
  result: MatchResult | null;
}

export class MemoryMatchLogStore implements MatchLogStore {
  private readonly matches = new Map<string, StoredMatch>();

  all(): StoredMatch[] {
    return [...this.matches.values()];
  }

  get(matchId: string): StoredMatch | undefined {
    return this.matches.get(matchId);
  }

  startMatch(meta: MatchMeta): Promise<void> {
    this.matches.set(meta.matchId, { meta, hands: [], result: null });
    return Promise.resolve();
  }

  appendHand(record: HandRecord): Promise<void> {
    this.require(record.matchId).hands.push(record);
    return Promise.resolve();
  }

  finishMatch(result: MatchResult): Promise<void> {
    this.require(result.matchId).result = result;
    return Promise.resolve();
  }

  private require(matchId: string): StoredMatch {
    const match = this.matches.get(matchId);
    if (match === undefined) throw new Error(`Partida desconocida en el log: ${matchId}`);
    return match;
  }
}
