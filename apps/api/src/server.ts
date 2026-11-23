// Servidor mínimo de H0: solo saluda y responde al healthcheck.
import { createServer, type Server, type ServerResponse } from 'node:http';

const SERVICE = 'api';

function send(res: ServerResponse, status: number, contentType: string, body: string): void {
  res.writeHead(status, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function createApiServer(): Server {
  return createServer((req, res) => {
    if (req.method !== 'GET') {
      send(res, 405, 'application/json', JSON.stringify({ error: 'method_not_allowed' }));
      return;
    }
    switch (req.url) {
      case '/':
        send(res, 200, 'text/plain; charset=utf-8', 'Hola desde la API de 31mus');
        return;
      case '/health':
        send(res, 200, 'application/json', JSON.stringify({ status: 'ok', service: SERVICE }));
        return;
      default:
        send(res, 404, 'application/json', JSON.stringify({ error: 'not_found' }));
    }
  });
}
