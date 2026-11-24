import { createVitestConfig } from '@31mus/config/vitest';
import { configDefaults } from 'vitest/config';

// Las simulaciones largas (*.sim.test.ts) van aparte, en vitest.sim.config.js (ADR-0003 §6).
export default createVitestConfig({
  coverageThreshold: 95,
  overrides: { test: { exclude: [...configDefaults.exclude, 'src/**/*.sim.test.ts'] } },
});
