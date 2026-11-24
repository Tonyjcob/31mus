/**
 * Comprobaciones de invariantes internos. Si fallan es un bug del motor, nunca un error de
 * dominio provocado por un jugador (ADR-0002 §7): por eso lanzan.
 */
export function first<T>(items: readonly T[], what: string): T {
  const [item] = items;
  if (item === undefined) throw new Error(`Invariante roto: ${what}.`);
  return item;
}

export function defined<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`Invariante roto: ${what}.`);
  return value;
}
