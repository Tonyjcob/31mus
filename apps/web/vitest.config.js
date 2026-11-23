import react from '@vitejs/plugin-react';

import { createVitestConfig } from '@31mus/config/vitest';

export default createVitestConfig({ environment: 'jsdom', overrides: { plugins: [react()] } });
