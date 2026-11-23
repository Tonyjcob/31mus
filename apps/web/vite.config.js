import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { parseEnv, webEnvSchema } from '@31mus/shared';

// El `.env` vive en la raíz del monorepo. Vite solo expone al cliente las variables `VITE_*`.
const envDir = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => {
  // Mismo esquema Zod que api y game (CLAUDE.md §5): HOST y WEB_PORT validados.
  const { HOST, WEB_PORT } = parseEnv(webEnvSchema, loadEnv(mode, envDir, ''));

  return {
    plugins: [react()],
    envDir,
    server: { host: HOST, port: WEB_PORT, strictPort: true },
    preview: { host: HOST, port: WEB_PORT, strictPort: true },
  };
});
