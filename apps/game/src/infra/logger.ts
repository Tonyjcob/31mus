// Logs estructurados (CLAUDE.md §5). Nunca se registran cartas ocultas, contraseñas ni tokens:
// los eventos de la partida van al log de manos (`MatchLogStore`), no aquí.
import { pino, type Logger } from 'pino';

export type { Logger };

export function createLogger(options: { level: string }): Logger {
  return pino({
    level: options.level,
    base: { service: 'game' },
    redact: { paths: ['*.token', '*.code', '*.password'], censor: '[oculto]' },
  });
}

/** Logger mudo para los tests. */
export const silentLogger: Logger = pino({ level: 'silent' });
