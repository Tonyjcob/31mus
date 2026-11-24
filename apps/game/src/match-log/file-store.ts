// Log de partidas en ficheros JSON Lines para desarrollo (ADR-0004 §4): un fichero por partida en
// `.data/match-logs/` (ignorado por git), una línea por registro: `start`, cada `hand` y `finish`.
// Contiene cartas: no se sirve nunca ni se sube al repositorio.
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { HandRecord, MatchLogStore, MatchMeta, MatchResult } from './match-log.js';

/** Solo identificadores seguros como nombre de fichero (nunca rutas). */
const MATCH_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export class FileMatchLogStore implements MatchLogStore {
  private ready: Promise<unknown> | null = null;
  private readonly pending = new Set<Promise<void>>();

  constructor(private readonly directory: string) {}

  async startMatch(meta: MatchMeta): Promise<void> {
    this.ready ??= mkdir(this.directory, { recursive: true });
    await this.ready;
    await this.write(meta.matchId, { type: 'start', ...meta });
  }

  appendHand(record: HandRecord): Promise<void> {
    return this.write(record.matchId, { type: 'hand', ...record });
  }

  finishMatch(result: MatchResult): Promise<void> {
    return this.write(result.matchId, { type: 'finish', ...result });
  }

  /** Se resuelve cuando no queda ninguna escritura en curso (para cerrar sin perder líneas). */
  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.allSettled([...this.pending]);
  }

  /** Ruta del fichero de una partida. */
  pathOf(matchId: string): string {
    if (!MATCH_ID_PATTERN.test(matchId)) throw new Error('Identificador de partida no válido.');
    return join(this.directory, `${matchId}.jsonl`);
  }

  private write(matchId: string, line: object): Promise<void> {
    const written = appendFile(this.pathOf(matchId), `${JSON.stringify(line)}\n`, 'utf8');
    this.pending.add(written);
    written.finally(() => this.pending.delete(written)).catch(() => undefined); // el error lo trata quien llamó
    return written;
  }
}
