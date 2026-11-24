import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { devIdentityVerifier } from './identity/dev-identity.js';
import { silentLogger } from './infra/logger.js';
import { cryptoRng } from './infra/rng.js';
import { createGameServer } from './server.js';
import { startTestServer, type TestBench } from './testing/test-server.js';

let bench: TestBench;
let baseUrl = '';

beforeAll(async () => {
  bench = await startTestServer();
  baseUrl = `http://127.0.0.1:${String(bench.port)}`;
});

afterAll(async () => {
  await bench.shutdown();
});

describe('servidor game', () => {
  it('responde al healthcheck en /health (GET y HEAD)', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ status: 'ok', service: 'game' });
    const head = await fetch(`${baseUrl}/health`, { method: 'HEAD' });
    expect(head.status).toBe(200);
  });

  it('ignora la query string en /health', async () => {
    const res = await fetch(`${baseUrl}/health?probe=1`);
    expect(res.status).toBe(200);
  });

  it('devuelve 404 en rutas desconocidas', async () => {
    const res = await fetch(`${baseUrl}/no-existe`);
    expect(res.status).toBe(404);
  });

  it('se niega a arrancar en producción con la identidad de desarrollo', () => {
    expect(() =>
      createGameServer({
        production: true,
        identity: devIdentityVerifier,
        rng: cryptoRng,
        logger: silentLogger,
      }),
    ).toThrow(/producción/);
  });
});
