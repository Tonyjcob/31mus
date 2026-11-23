# Arquitectura de 31mus

> Documento vivo: se actualiza al cerrar cada hito (CLAUDE.md §14).
> Las decisiones de detalle están en `docs/adr/`. Última actualización: H0 (23/11/2026).

## 1. Visión general

```
 Navegador ──HTTP/REST──▶ apps/api  (NestJS, H6) ──▶ PostgreSQL (Prisma)
     │                         │
     │ WebSocket               └──── ticket de juego (JWT 60 s)
     ▼
 apps/game (Colyseus, H3) ──▶ Redis (presencia, listado, rate-limit, cola clasificatoria)
     │
     └── usa packages/engine (reglas puras) + packages/bots (IA)
```

- **El servidor de juego es la autoridad**: el cliente solo envía intenciones y el servidor las
  valida con el motor (CLAUDE.md §2).
- **La información oculta no sale del servidor**: cada cliente recibe solo su vista (`getView`).

## 2. Paquetes y apps

| Ruta | Rol | Estado |
|---|---|---|
| `packages/engine` | Reglas del mus, puras y deterministas | H0: `Seat`, `nextSeat`, `partnerOf` |
| `packages/bots` | IA de bots y personajes | Vacío (H2) |
| `packages/shared` | Constantes, esquemas Zod, mensajes cliente↔servidor | Constantes y `parseEnv` |
| `packages/design-tokens` | Tokens volcados de Figma | Vacío (H4) |
| `packages/config` | tsconfig, ESLint, Prettier, Vitest compartidos | Completo |
| `apps/web` | Cliente React + Vite | «Hola» |
| `apps/api` | API REST | «Hola» + `/health` en `node:http` (NestJS en H6) |
| `apps/game` | Servidor de juego | «Hola» + `/health` en `node:http` (Colyseus en H3) |

## 3. Reglas de dependencias

Validadas por dependency-cruiser en `pnpm lint` (`.dependency-cruiser.cjs`):

```
engine        ← (nada)
bots          → engine
shared        → engine (solo tipos)
design-tokens ← (nada)
game          → engine, bots, shared
api           → shared
web           → shared, design-tokens, engine (solo presentación)
```

Además: `engine`, `bots`, `shared` y `design-tokens` no pueden usar módulos de Node, no hay ciclos,
todo import debe estar declarado en su `package.json` y el código de producción no importa
devDependencies. El perfil ESLint `pure` (engine, bots) prohíbe además el azar y el tiempo implícitos.

## 4. Modelo de compilación

- Cada paquete compila con `tsc` a `dist/` y lo expone en `exports` (ESM, `nodenext`).
- Turborepo ejecuta `build` de las dependencias antes de `dev`, `lint`, `typecheck` y `test`.
- En desarrollo, los paquetes corren `tsc --watch`, las apps de Node `tsx watch` y la web Vite.

## 5. Entornos

| Servicio | Desarrollo | Puerto |
|---|---|---|
| web | Vite en el host | 5173 |
| api | tsx en el host | 3000 |
| game | tsx en el host | 2567 |
| PostgreSQL 18 | Docker (`docker-compose.yml`) | 5432 (solo 127.0.0.1) |
| Redis 8 | Docker | 6379 (solo 127.0.0.1) |

Variables en `.env` (ver `.env.example`), validadas con Zod al arrancar cada app.
Producción (`docker-compose.prod.yml` + Caddy) se define en H10.

## 6. Calidad y seguridad del repositorio

- **Hooks**: `pre-commit` (gitleaks + ESLint/Prettier de lo preparado) y `commit-msg` (commitlint).
- **CI** (GitHub Actions): lint → typecheck → test (cobertura del motor ≥ 95 %) → build →
  `pnpm audit`; gitleaks sobre todo el historial.
- **Dependabot** semanal: npm, GitHub Actions y docker-compose.
