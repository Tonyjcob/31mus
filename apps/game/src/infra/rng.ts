// Azar de producción (CLAUDE.md §2.4, ADR-0004 §2): `crypto.randomInt`, criptográficamente seguro.
// En tests se inyecta `createSeededRng` del motor.
import { randomInt } from 'node:crypto';

import type { Rng } from '@31mus/engine';

export const cryptoRng: Rng = {
  nextInt(bound: number): number {
    return randomInt(bound);
  },
};
