// Servidor mínimo de H0: solo saluda y responde al healthcheck.
// Provisional: se sustituye por NestJS en H6.
import { createServer, type Server, type ServerResponse } from 'node:http';

const SERVICE = 'api';
const GREETING = 'Hola desde la API de 31mus';
const ALLOWED_METHODS = 'GET, HEAD';

function send(
  res: ServerResponse,
  status: number,
  contentType: string,
  body: string,
  extraHeaders: Record<string, string> = {},
): void {
  res.writeHead(status, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  // En las peticiones HEAD, Node omite el cuerpo automáticamente.
  res.end(body);
}

export function createApiServer(): Server {
  return createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, 'application/json', JSON.stringify({ error: 'method_not_allowed' }), {
        Allow: ALLOWED_METHODS,
      });
      return;
    }
    // Solo importa la ruta: la query string se ignora (p. ej. /health?probe=1).
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    switch (pathname) {
      case '/':
        send(res, 200, 'text/plain; charset=utf-8', GREETING);
        return;
      case '/health':
        send(res, 200, 'application/json', JSON.stringify({ status: 'ok', service: SERVICE }));
        return;
      default:
        send(res, 404, 'application/json', JSON.stringify({ error: 'not_found' }));
    }
  });
}
