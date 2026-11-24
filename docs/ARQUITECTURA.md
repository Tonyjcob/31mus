# Arquitectura de 31mus

> Documento vivo: se actualiza al cerrar cada hito (CLAUDE.md §14).
> Las decisiones de detalle están en `docs/adr/`. Última actualización: H1 (24/11/2026).

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
| `packages/engine` | Reglas del mus, puras y deterministas | Completo (H1, §7) |
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

## 7. Motor de reglas (`packages/engine`)

Diseño en `docs/adr/ADR-0002-motor-de-reglas.md`; reglas en `docs/REGLAS_MUS.md` (D1–D4, D10–D17).

**Modelo.** `MatchState` es JSON inmutable: marcador, juegos ganados, mano actual y una `Phase` por
unión discriminada (`mus` → `discard` → `mus` … → `lance` × 4 → `handOver`). Cada transición es una
función pura que devuelve un `Step` (`{ state, events }`). El azar entra por un `Rng` inyectado; la
semilla nunca está en el estado.

**API pública** (`src/index.ts`):

| Función | Qué hace |
|---|---|
| `createMatch(config, rng)` | Sortea la primera mano (o usa `firstMano`) y reparte |
| `getLegalActions(state, seat)` | Acciones legales de un asiento; única fuente de verdad de la legalidad |
| `pendingSeats(state)` | Asientos a los que se espera (los cuatro en el descarte, que es simultáneo) |
| `applyAction(state, seat, action, { rng })` | `Result<Step, MusError>`: `NOT_YOUR_TURN`, `ILLEGAL_ACTION`, `MATCH_OVER` |
| `startNextHand(state, { rng })` | Tras `handOver`: rota la mano, reparte y, si se ganó un juego, pone los tantos a 0 |
| `getTimeoutAction(state, seat)` | Acción por tiempo agotado (D1, D12, D15) o `null` |
| `getView(state, viewer)` | Lo que puede ver un jugador o espectador (§9 de las reglas, D17) |
| `getEventView(event, viewer)` | Filtra cada evento; **todo evento sale del servidor por aquí** |

También exporta los evaluadores (`compareGrande`, `comparePares`, `juegoKey`…), las constantes de
reglas (`src/rules.ts`) y `createSeededRng` (xoshiro128\*\*) para tests y simulaciones.

**Módulos.** `cards`, `deck` (reparto, reposición y rebarajado D10), `evaluators/` (los cinco lances),
`phases/` (mus, descarte, lances, envites D12–D14, órdago, recuento con corte a 40), `legal-actions`,
`apply-action`, `match`, `timeout`, `view` y `events`. `src/testing/` contiene notación de cartas,
escenarios y el jugador aleatorio; no se compila ni cuenta para la cobertura.

**Pruebas.** Tests unitarios por módulo, la tabla de 62 casos de `docs/engine/CASOS_EVALUACION.md`,
tests de propiedades con fast-check (cartas, tantos, turnos, fugas de información, inmutabilidad,
serialización JSON) y 1.000 partidas aleatorias completas. Cobertura del 100 %.

**Pendiente para el servidor (H3).** El `Rng` de producción con `crypto.randomInt` vive en
`apps/game`, no en el motor; el temporizador de turno y la pausa para mostrar las cartas al final de
la mano también los decide el servidor.
