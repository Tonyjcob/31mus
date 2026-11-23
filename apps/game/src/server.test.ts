import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createGameServer } from './server.js';

const server = createGameServer();
let baseUrl = '';

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${String(port)}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

describe('servidor game', () => {
  it('saluda en /', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hola desde el servidor de juego de 31mus');
  });

  it('responde al healthcheck', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', service: 'game' });
  });

  it('ignora la query string en el healthcheck', async () => {
    const res = await fetch(`${baseUrl}/health?probe=1`);
    expect(res.status).toBe(200);
  });

  it('responde a HEAD sin cuerpo', async () => {
    const res = await fetch(`${baseUrl}/health`, { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('devuelve 404 en rutas desconocidas', async () => {
    const res = await fetch(`${baseUrl}/no-existe`);
    expect(res.status).toBe(404);
  });

  it('rechaza métodos distintos de GET y HEAD con la cabecera Allow', async () => {
    const res = await fetch(`${baseUrl}/health`, { method: 'POST' });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET, HEAD');
  });
});
