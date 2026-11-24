/**
 * Errores de dominio del motor (ADR-0002 §7). El mensaje es para logs, en español,
 * y **nunca** incluye cartas.
 */
export const MUS_ERROR_CODES = [
  'NOT_YOUR_TURN',
  'ILLEGAL_ACTION',
  'HAND_NOT_OVER',
  'MATCH_OVER',
] as const;

export type MusErrorCode = (typeof MUS_ERROR_CODES)[number];

export interface MusError {
  readonly code: MusErrorCode;
  readonly message: string;
}

export function musError(code: MusErrorCode, message: string): MusError {
  return { code, message };
}
