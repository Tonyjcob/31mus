/**
 * Resultado tipado de las operaciones del motor (CLAUDE.md §5, ADR-0002 §7).
 * El motor no lanza excepciones por errores de dominio: devuelve `err(...)`.
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
