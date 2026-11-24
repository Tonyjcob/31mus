import { createVitestConfig } from '@31mus/config/vitest';

// Cobertura ≥ 90 % (ADR-0004 §8). Fuera: el cliente de consola (herramienta de desarrollo) y el
// arranque del proceso (`main.ts`), que se prueba arrancando el servidor.
export default createVitestConfig({
  coverageThreshold: 90,
  overrides: { test: { coverage: { exclude: ['src/cli/**', 'src/main.ts'] } } },
});
