/**
 * Azar inyectado (ADR-0002 §2). El motor nunca genera azar por su cuenta: recibe un `Rng`.
 * En producción, `apps/game` inyecta uno criptográfico (`node:crypto.randomInt`); en tests,
 * bots y simulaciones se usa `createSeededRng`, reproducible a partir de una semilla.
 */
export interface Rng {
  /** Entero uniforme en `[0, bound)`. `bound` es un entero entre 1 y 2³². */
  nextInt(bound: number): number;
}

const UINT32_RANGE = 2 ** 32;

function assertBound(bound: number): void {
  if (!Number.isInteger(bound) || bound < 1 || bound > UINT32_RANGE) {
    // Error de programación, no de dominio: ningún jugador puede provocarlo.
    throw new RangeError(`Rng.nextInt: límite no válido (${String(bound)}).`);
  }
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** splitmix32: expande la semilla al estado inicial de xoshiro128**. */
function splitmix32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

/**
 * Núcleo de xoshiro128** (Blackman y Vigna) a partir de su estado de 4 palabras de 32 bits.
 * Interno: se exporta solo para comprobarlo contra el vector de referencia en los tests.
 */
export function xoshiro128ss(state: readonly [number, number, number, number]): () => number {
  let [s0, s1, s2, s3] = state;
  return () => {
    const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (s1 << 9) >>> 0;
    s2 = (s2 ^ s0) >>> 0;
    s3 = (s3 ^ s1) >>> 0;
    s1 = (s1 ^ s2) >>> 0;
    s0 = (s0 ^ s3) >>> 0;
    s2 = (s2 ^ t) >>> 0;
    s3 = rotl(s3, 11);
    return result;
  };
}

/**
 * Generador determinista xoshiro128** sembrado con splitmix32. **No es criptográfico**:
 * solo para tests, bots y simulaciones. Es el único objeto con estado del motor y nunca
 * forma parte de `MatchState`.
 */
export function createSeededRng(seed: number): Rng {
  const init = splitmix32(seed);
  const nextUint32 = xoshiro128ss([init(), init(), init(), init()]);

  return {
    nextInt(bound) {
      assertBound(bound);
      // Muestreo por rechazo: descarta el tramo final que causaría sesgo de módulo.
      const limit = UINT32_RANGE - (UINT32_RANGE % bound);
      let x = nextUint32();
      while (x >= limit) {
        x = nextUint32();
      }
      return x % bound;
    },
  };
}

/** Fisher–Yates sobre una copia: no muta la entrada. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
}
