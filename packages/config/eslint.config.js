import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

// El propio paquete de configuración solo tiene JS: reglas recomendadas sin tipos.
export default defineConfig(
  globalIgnores(['**/node_modules/**']),
  js.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },
  prettier,
);
