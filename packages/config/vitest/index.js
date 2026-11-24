// Configuración base de Vitest. Cada paquete la extiende en su `vitest.config.js`.
import { defineConfig, mergeConfig } from 'vitest/config';

/**
 * @param {{
 *   environment?: 'node' | 'jsdom',
 *   coverageThreshold?: number,
 *   overrides?: import('vitest/config').ViteUserConfig,
 * }} [options]
 */
export function createVitestConfig({
  environment = 'node',
  coverageThreshold,
  overrides = {},
} = {}) {
  const thresholds =
    coverageThreshold === undefined
      ? undefined
      : {
          lines: coverageThreshold,
          branches: coverageThreshold,
          functions: coverageThreshold,
          statements: coverageThreshold,
        };

  const base = defineConfig({
    test: {
      environment,
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', 'src/testing/**'],
        reporter: ['text', 'html', 'lcov'],
        ...(thresholds ? { thresholds } : {}),
      },
    },
  });

  return mergeConfig(base, overrides);
}
