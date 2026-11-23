import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// El `.env` vive en la raíz del monorepo. Vite solo expone al cliente las variables `VITE_*`.
const envDir = fileURLToPath(new URL('../..', import.meta.url));
const DEFAULT_WEB_PORT = 5173;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const port = Number(env.WEB_PORT ?? DEFAULT_WEB_PORT);

  return {
    plugins: [react()],
    envDir,
    server: { host: '127.0.0.1', port, strictPort: true },
    preview: { host: '127.0.0.1', port, strictPort: true },
  };
});
