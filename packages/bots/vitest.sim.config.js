import { defineConfig } from 'vitest/config';

// Simulación completa de la DoD de H2 (ADR-0003 §6): `pnpm --filter @31mus/bots sim`.
// No extiende la configuración base: mergeConfig concatenaría su `include` con este.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.sim.test.ts'],
    testTimeout: 1_800_000,
  },
});
