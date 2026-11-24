// Identidad de desarrollo (ADR-0004 §3): el cliente dice quién es. Solo fuera de producción.
import { devIdentitySchema } from '@31mus/shared';

import type { Identity, IdentityVerifier } from './identity.js';

export const devIdentityVerifier: IdentityVerifier = {
  devOnly: true,
  verify(joinOptions: unknown): Promise<Identity | null> {
    const parsed = devIdentitySchema.safeParse(joinOptions);
    return Promise.resolve(parsed.success ? { ...parsed.data, kind: 'guest' } : null);
  },
};
