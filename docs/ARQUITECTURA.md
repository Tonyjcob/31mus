# Arquitectura de 31mus

> Documento vivo: se actualiza al cerrar cada hito (CLAUDE.md §14).
> Las decisiones de detalle están en `docs/adr/`. Última actualización: H3 (25/11/2026).

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
| `packages/bots` | IA de bots y personajes | Completo (H2, §8) |
| `packages/shared` | Constantes, esquemas Zod, mensajes cliente↔servidor | Constantes, `parseEnv` y protocolo de `game` (H3, §9) |
| `packages/design-tokens` | Tokens volcados de Figma | Vacío (H4) |
| `packages/config` | tsconfig, ESLint, Prettier, Vitest compartidos | Completo |
| `apps/web` | Cliente React + Vite | «Hola» |
| `apps/api` | API REST | «Hola» + `/health` en `node:http` (NestJS en H6) |
| `apps/game` | Servidor de juego | Colyseus completo, sin clasificatoria (H3, §9) |

## 3. Reglas de dependencias

Validadas por dependency-cruiser en `pnpm lint` (`.dependency-cruiser.cjs`):

```
engine        ← (nada)
bots          → engine
shared        → engine (solo tipos)
design-tokens ← (nada)
game          → engine, bots, shared (y db desde H6, D18)
api           → shared (y db desde H6)
db            → shared (solo tipos; H6)
web           → shared, design-tokens, engine (solo presentación)
```

Además: `engine`, `bots`, `shared` y `design-tokens` no pueden usar módulos de Node, no hay ciclos,
todo import debe estar declarado en su `package.json` y el código de producción no importa
devDependencies (salvo `apps/game/src/testing/` y `src/cli/`, herramientas fuera del build). El perfil ESLint `pure` (engine, bots) prohíbe además el azar y el tiempo implícitos.

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

## 8. Bots (`packages/bots`)

Diseño en `docs/adr/ADR-0003-bots.md`; mediciones en `docs/bots/MEDICIONES.md`.

**Sin trampas por construcción.** El bot recibe la `PlayerView` de su asiento y las acciones legales,
nunca el `MatchState`: ve lo mismo que un humano sentado en ese sitio.

**API pública** (`src/index.ts`):

| Exporta | Qué hace |
|---|---|
| `decideAction({ view, legal, persona, rng })` | Bot medio: devuelve `{ action, bluff }`; la acción es siempre una de `legal` |
| `randomAction(legal, rng)` | Bot aleatorio de referencia (también para los tests de `apps/game`) |
| `BOT_PERSONAS`, `NEUTRAL_PERSONA` | Catálogo de personajes; el neutro sustituye a quien se desconecta |
| `BotPersona`, `BotStyle`, `BotInput`, `BotDecision` | Tipos |

El retardo «humano» (`BOT_DELAY_MIN_MS`–`BOT_DELAY_MAX_MS`, en `shared`) lo aplica el servidor.

**Cómo decide.** La fuerza de la mano en cada lance sale de tablas exactas por combinación de figuras
(330 combinaciones, 91.390 manos), calculadas al cargar el paquete con los evaluadores del motor
(`strength.ts`). `odds.ts` la convierte en la probabilidad de que gane la pareja, según quién juega el
lance, lo que hizo el compañero y si un rival envidó (`situation.ts`). Con eso: mus y descarte por valor
esperado (`value.ts`), envites, respuestas, faroles y órdagos (`betting.ts`). Los personajes son cinco
parámetros de estilo (`personas.ts`) sobre las constantes de ajuste de `tuning.ts`.

**Pruebas.** Escenarios de cada decisión; en 1.000 partidas, legalidad, determinismo e independencia
de las cartas ocultas; 2.000 partidas contra el aleatorio (≥ 70 %) en cada commit. La DoD completa
(10.000 partidas y la matriz de personajes) va aparte: `pnpm --filter @31mus/bots sim` (~10 min).
Cobertura del 100 %.

## 9. Servidor de juego (`apps/game`)

Diseño en `docs/adr/ADR-0004-servidor-de-juego.md`; decisiones de producto D17–D22 en `docs/HITOS.md`.

**Capas.** Colyseus queda en el borde; la lógica de la mesa no depende de él y se prueba con un reloj
falso:

| Módulo | Responsabilidad |
|---|---|
| `rooms/mus-room.ts` | Adaptador de Colyseus: valida cada mensaje con Zod, traduce conexiones (`onJoin`, `onDrop`, `onReconnect`, `onLeave`) y refleja el estado público |
| `rooms/admission.ts`, `rooms/participants.ts` | Quién entra (código privado, plazas, espectadores ≤ 5) y quién está conectado o caído |
| `table/table.ts` | Lobby + partida: sentarse, empezar por modo, ceder el asiento al bot y recuperarlo (D7) |
| `table/lobby.ts` | Asientos, modos y personajes (elegidos al crear; el resto por sorteo, D22) |
| `table/table-session.ts` | Quién controla cada asiento, pausa sin humanos y cierre por abandono (D20) o tras el fin |
| `table/match-controller.ts` | Acciones idempotentes (`actionId` + `version`), turnos, bots, pausa entre manos (D19), fin |
| `table/turn-timers.ts` | Plazo de 30 s con acción por tiempo agotado y retardo de 1–3 s de los bots |
| `table/outbound.ts` | **Único** sitio que construye lo que recibe cada cliente: `getView` y `getEventView` por destinatario |
| `chat/room-chat.ts` | Chat y reacciones: saneado, autor puesto por el servidor y límites por usuario (D21) |
| `match-log/` | Puerto `MatchLogStore` y `MatchRecorder`: cada mano con eventos completos, hora y actor |
| `infra/` | `Rng` con `crypto.randomInt`, `Scheduler` inyectable, rate-limiter en memoria y pino |
| `identity/` | Puerto de identidad; en H3 solo la de desarrollo, que se niega a arrancar en producción |

**Qué viaja.** El `Schema` de Colyseus solo tiene datos públicos (modo, estado, asientos con apodo o
personaje, número de espectadores). La partida va en mensajes por cliente: `game:view` (vista filtrada,
acciones legales y `deadline`, solo para su asiento), `game:events` (eventos filtrados),
`game:actionResult`, `room:you`, `room:error`, `chat:message` y `reaction`. Contratos en
`packages/shared/src/protocol/`.

**Log de partidas.** Contiene cartas: solo vive en el servidor. En H3, memoria (tests) y ficheros JSON
Lines en `apps/game/.data/match-logs/` (ignorado por git); en H6, Prisma desde `packages/db` (D18).

**Herramientas.** `pnpm --filter @31mus/game play` (cliente de consola contra `pnpm dev`) y
`pnpm --filter @31mus/game play:script` (partida completa con servidor propio y tiempos cortos).
Viven en `src/cli/`, fuera del build.

**Pruebas.** Unidad con reloj falso (controlador, turnos, lobby, chat, log); integración con clientes
reales del SDK (lobby, modos, sala privada, espectadores, turnos, caídas y reconexión, pausa y
abandono, chat y límites); **test de fuga de información** sobre partidas completas con caídas y
vueltas, que busca cartas ajenas en todo el JSON recibido por cada cliente; contratos `shared` ↔
`engine`. Cobertura ≥ 90 % (sin `src/cli/` ni `main.ts`).
