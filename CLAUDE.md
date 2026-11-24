# CLAUDE.md — 31mus

> Normas del proyecto para Claude Code. **Léelo entero al inicio de cada sesión**, junto con
> `docs/HITOS.md` (qué toca hacer) y `docs/REGLAS_MUS.md` (especificación del juego).
> Si algo de este documento entra en conflicto con una petición del usuario, **pregunta antes de actuar**.

---

## 1. Qué es 31mus

Web para jugar al **mus online** (variante de 8 reyes), en español, responsive, con:

- **Modos**: Solo (tú + bot vs 2 bots) · Online 2 vs bots (2 humanos vs 2 bots) · Online 2 vs 2 (4 humanos).
- **Salas** públicas y privadas (código de acceso), lobby con 4 asientos.
- **Listado de partidas en curso** con modo espectador (máx. 5), chat común y reacciones con emojis flotantes.
- **Partida clasificatoria** (modelo PokerArena): cola de emparejamiento 2 vs 2 por ELO, separada de las salas
  (que son siempre **casuales**, sin ELO). **Temporadas** con clasificación e insignias.
- **Bots con personaje** (modelo Chess.com): cada bot tiene nombre, avatar y estilo de juego propio.
- **Usuarios**: registro email+contraseña, Google OAuth, o invitado. ELO (solo clasificatoria) y experiencia.
- **Tutorial** opcional con partida guiada contra bots.
- **Referencias de producto**: interfaz y usabilidad de **Chess.com** y **Gambit** (su versión de cartas);
  sistema de ranking y perfil de **PokerArena**. Son referencias de estructura y calidad: **nunca copiar**
  su marca, sus assets, su fuente (Chess Sans) ni su sistema de diseño.

**Objetivo a largo plazo**: plataforma escalable, con monedas virtuales (fase futura) y una arquitectura que
no impida —si algún día se obtiene licencia— operar con dinero real. Por eso **la calidad, la trazabilidad
y la seguridad del código son prioridad máxima**, por encima de la velocidad.

**Prioridad actual (Fase 1)**: que sea **jugable, estable y sin errores**. La estética definitiva
(animaciones vistosas, baraja final, avatares) es la Fase 2. No mezclar. La estructura y el tema oscuro
de las pantallas sí se implementan desde H4 siguiendo el diseño de Figma (§13).

---

## 2. Principios innegociables

1. **El servidor es la autoridad.** El cliente solo envía *intenciones* (`acción + payload`). El servidor
   valida contra el motor de reglas y emite el nuevo estado. Nunca se confía en nada del cliente.
2. **Información oculta = nunca sale del servidor.** Un cliente solo recibe **sus propias cartas**.
   Las cartas de los demás, el mazo y los descartes ajenos **jamás** se serializan hacia ese cliente,
   tampoco hacia espectadores. Al final de la mano solo se revelan las cartas que las reglas obligan a
   mostrar para el recuento. Hay tests que lo verifican (ver §9).
3. **Motor de reglas puro.** `packages/engine` no tiene I/O, ni red, ni `Date.now()`, ni `Math.random()`.
   El azar y el tiempo se inyectan. Mismo estado + misma acción + misma semilla = mismo resultado.
4. **Barajado criptográficamente seguro** en producción: Fisher–Yates con `crypto.randomInt`.
   En tests, RNG con semilla.
5. **Todo se registra.** Cada mano genera un log de eventos inmutable (acción, actor, timestamp, estado
   resultante resumido) persistido en BD → permite repetición, auditoría y depuración.
6. **Sin secretos en el repo** (es público). Ver §11.
7. **Tests primero en el motor.** Ninguna regla se implementa sin su test. Cobertura del motor ≥ 95 %.
8. **Pequeño y revisable.** Commits pequeños, un hito cada vez, parar a revisión al cerrar cada hito.

---

## 3. Stack

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript `strict` en todo el monorepo |
| Monorepo | pnpm workspaces + Turborepo |
| Motor de reglas | `packages/engine` — TS puro |
| Bots | `packages/bots` — depende solo de `engine` |
| Contratos compartidos | `packages/shared` — tipos, mensajes, esquemas **Zod**, constantes |
| Servidor de juego | `apps/game` — **Colyseus** (salas, asientos, reconexión, espectadores) |
| API | `apps/api` — **NestJS** (auth, usuarios, ranking, salas, historial) |
| Base de datos | **PostgreSQL** + **Prisma** (migraciones versionadas) |
| Caché / presencia | **Redis** (presencia Colyseus, listado de partidas, rate-limit) |
| Frontend | `apps/web` — **React + Vite**, Zustand (estado de juego), TanStack Query (REST), React Router |
| Estilos | CSS con **design tokens** (variables CSS) generados desde `packages/design-tokens`; Tailwind opcional consumiendo esos tokens |
| Animación (Fase 2) | Motion (framer-motion) |
| Audio | Howler.js |
| Tests | **Vitest** (unit/integración), **fast-check** (property-based en motor), **Playwright** (e2e) |
| Calidad | ESLint (typescript-eslint estricto) + Prettier + Husky + lint-staged + commitlint |
| Seguridad repo | gitleaks (pre-commit + CI), Dependabot |
| Infra | Docker + Docker Compose; Caddy (HTTPS) en producción |
| CI | GitHub Actions: lint → typecheck → test → build → gitleaks |

No añadir dependencias nuevas sin justificarlo en el commit. Preferir pocas y mantenidas.

---

## 4. Estructura del repositorio

```
31mus/
├─ apps/
│  ├─ web/            # React + Vite (cliente)
│  ├─ api/            # NestJS (REST + auth)
│  └─ game/           # Colyseus (tiempo real)
├─ packages/
│  ├─ engine/         # Reglas del mus (puro, sin I/O)
│  ├─ bots/           # IA de bots (dificultad media, faroles) y personajes (perfiles de estilo)
│  ├─ shared/         # Tipos, esquemas Zod, mensajes cliente↔servidor, constantes
│  ├─ design-tokens/  # Tokens de diseño volcados desde las variables de Figma
│  └─ config/         # tsconfig, eslint, prettier, vitest base
├─ infra/
│  ├─ docker/         # Dockerfiles por app
│  ├─ caddy/          # Caddyfile producción
│  └─ scripts/        # utilidades (seed, backup…)
├─ assets/            # Recursos de terceros CON su licencia (ver §12)
├─ docs/
│  ├─ HITOS.md        # Plan de hitos y estado
│  ├─ REGLAS_MUS.md   # Especificación formal del juego
│  ├─ ARQUITECTURA.md # (se crea en H0 y se mantiene)
│  └─ adr/            # Decisiones de arquitectura (ADR-0001-*.md)
├─ docker-compose.yml       # desarrollo
├─ docker-compose.prod.yml  # producción
├─ .env.example
├─ LICENSE                  # Todos los derechos reservados
└─ CLAUDE.md
```

Reglas de dependencia (**se validan con eslint `import/no-restricted-paths` o dependency-cruiser**):
- `engine` → no depende de nada del monorepo.
- `bots` → solo `engine`.
- `shared` → puede importar tipos de `engine`.
- `game` → `engine`, `bots`, `shared`.
- `api` → `shared`.
- `web` → `shared`, `design-tokens`, y **solo tipos/utilidades de presentación** de `engine`
  (p. ej. nombres de cartas). **Nunca** lógica de validación como fuente de verdad.

---

## 5. Convenciones de código

- **Idioma**: identificadores en **inglés**, excepto los **términos del dominio del mus**, que se mantienen
  en español sin tildes: `grande`, `chica`, `pares`, `juego`, `punto`, `envite`, `ordago`, `mus`,
  `mano`, `postre`, `amarraco`, `deje`, `medias`, `duples`, `pareja`. Comentarios, docs y textos de UI en **español**.
- TypeScript `strict`, `noUncheckedIndexedAccess: true`. **Prohibido `any`** (usar `unknown` + validación).
- Sin `enum` de TS: usar uniones literales `as const`.
- Funciones del motor puras, inmutables (devuelven estado nuevo). Nada de clases con estado en `engine`.
- Errores de dominio tipados (`Result<T, MusError>` en el motor; excepciones solo en bordes de I/O).
- Toda entrada externa (mensajes WS, cuerpos REST, query params, env) se valida con **Zod** en `shared`.
- Nombres de archivo `kebab-case.ts`; componentes React `PascalCase.tsx`.
- Un componente / módulo = una responsabilidad. Archivos > 300 líneas → dividir.
- Sin números mágicos. Constantes de **producto** en `packages/shared/src/constants.ts`
  (`TURN_TIMEOUT_MS = 30_000`, `MAX_SPECTATORS = 5`…); constantes de **reglas** en
  `packages/engine/src/rules.ts` (`POINTS_TO_WIN_GAME = 40`, `GAMES_TO_WIN_MATCH = 2`, `MAX_BET = 40`…),
  porque `engine` no puede importar `shared` (ADR-0002).
- Textos de UI centralizados en `apps/web/src/i18n/es.ts` (solo español de momento, pero preparado para i18n).
- Logs estructurados (pino) con `roomId`, `handId`, `userId`. **Nunca** loguear cartas ocultas, contraseñas ni tokens.

### Git
- Rama por hito: `hito/H1-motor-reglas`. Merge a `main` vía PR cuando el usuario lo apruebe.
- **Conventional Commits** (tipo en inglés, descripción en español):
  `feat(engine): evaluar lance de pares`, `fix(game): reconexión no recuperaba asiento`.
- Commits pequeños y atómicos; cada commit compila y pasa tests.
- Nunca `--no-verify`. Nunca reescribir historia de `main`.

---

## 6. Modelo del motor (`packages/engine`)

API pública mínima:

```ts
createMatch(config: MatchConfig, rng: Rng): MatchState
getLegalActions(state: MatchState, seat: Seat): readonly Action[]
applyAction(state: MatchState, seat: Seat, action: Action, ctx: { rng: Rng }): Result<{ state: MatchState; events: readonly GameEvent[] }, MusError>
startNextHand(state: MatchState, ctx: { rng: Rng }): Result<{ state: MatchState; events: readonly GameEvent[] }, MusError>
getView(state: MatchState, viewer: Seat | 'spectator'): PlayerView   // filtra información oculta
getEventView(event: GameEvent, viewer: Seat | 'spectator'): GameEvent | null   // filtra cada evento
getTimeoutAction(state: MatchState, seat: Seat): Action | null
```

- Diseño detallado en `docs/adr/ADR-0002-motor-de-reglas.md`. Al acabar una mano el estado queda en
  `handOver` con las cartas reveladas; el servidor llama a `startNextHand` cuando toca. **Todo evento
  pasa por `getEventView` antes de salir del servidor.**

- `Seat = 0 | 1 | 2 | 3`. Parejas: **0 y 2** contra **1 y 3**. El orden de juego es **antihorario**
  (`siguiente = (seat + 1) % 4` representa "a la derecha").
- Fases: `mus` → `descarte` → (repetir) → `grande` → `chica` → `pares` (declaración + envites)
  → `juego` o `punto` (declaración + envites) → `recuento` → nueva mano / fin de juego / fin de partida.
- Toda la especificación está en `docs/REGLAS_MUS.md`. **Si una regla no está ahí o es ambigua: parar y preguntar al usuario.**
- El temporizador NO vive en el motor: el servidor de juego, al vencer el turno, aplica la
  **acción por defecto** que el motor expone con `getTimeoutAction(state, seat)`.

---

## 7. Servidor de juego (`apps/game`)

- Una `MusRoom` de Colyseus por mesa. Metadatos de sala: `mode` (`solo` | `duo_vs_bots` | `2v2` | `ranked`),
  `visibility` (`public` | `private`), `hasCode`, `seatsTaken`, `spectators`, `status`.
- **Lobby**: el jugador entra a la sala y elige un asiento libre. Asientos 0/2 y 1/3 son parejas.
  La partida **empieza cuando todos los asientos humanos requeridos están ocupados**:
  - `solo`: 1 humano → bots en los otros 3 asientos, empieza al instante.
  - `duo_vs_bots`: espera a **2 humanos** (en asientos de la misma pareja); bots en la otra pareja.
  - `2v2`: espera a **4 humanos**. No se rellena con bots al inicio.
- **Abandono / desconexión**: el asiento pasa a un bot inmediatamente (el turno no se bloquea).
  Si el jugador vuelve en cualquier momento **mientras dure la partida** (`allowReconnection` + reentrada
  por `userId`), **recupera su asiento** y el bot sale
  al terminar la acción en curso.
- **Salas privadas**: aparecen en el listado, pero unirse (como jugador o espectador) requiere el código
  de 6 caracteres generado al crearla. Código comparado en tiempo constante; rate-limit de intentos.
- **Espectadores**: máximo 5 por sala. Reciben `getView(state, 'spectator')`: mesa, marcador, amarracos,
  envites y número de cartas, **nunca cartas**. Pueden chatear y reaccionar.
- **Chat**: único para jugadores y espectadores. Mensajes ≤ 200 caracteres, sanitizados, rate-limit
  (p. ej. 5 msg / 10 s), etiqueta de rol (jugador/espectador).
- **Reacciones**: emojis de una lista cerrada (definida en `shared`), mostrados como emojis flotantes.
  Rate-limit propio.
- **Estado sincronizado**: el `Schema` de Colyseus contiene solo información pública. Las manos privadas
  se envían con `client.send('hand', …)` a cada jugador o con filtros por cliente. Revisar siempre que
  ningún campo del schema público contenga cartas.
- **Partida clasificatoria (matchmaking)**: cola en Redis gestionada por el servidor de juego.
  - Se entra **solo** o **con pareja** (invitando a un amigo; la pareja entra con la media de sus ELO).
  - El emparejador agrupa 4 jugadores (o 2 parejas) con ELO cercano; la ventana de ELO admitida se amplía
    con el tiempo de espera (p. ej. ±100 → ±400 en 60 s). Si no hay rivales, se sigue esperando: **nunca bots en clasificatoria**.
  - Las parejas formadas por el emparejador se sientan 0/2 y 1/3. Al formarse, se crea una `MusRoom` con
    `mode: 'ranked'`, `visibility: 'public'` (aparece en el listado y admite espectadores).
  - Abandono en clasificatoria: entra un bot para que la partida termine, pero **quien abandona pierde ELO
    como derrota** si no vuelve antes del final. Su pareja no pierde ELO extra por ello (decisión a confirmar en H7).
  - Solo usuarios registrados. Los invitados no ven el botón de clasificatoria.
- **Bots con personaje**: cada asiento de bot usa un `BotPersona` de `packages/bots` (id, nombre, avatar,
  descripción de una línea y parámetros de estilo: agresividad al envidar, frecuencia de farol, propensión al
  órdago, tendencia a cortar el mus). Todos juegan a nivel **medio**: el personaje cambia el estilo, no la fuerza.
  Catálogo inicial en `docs/HITOS.md` (H2). En `solo` y `duo_vs_bots` el jugador elige los personajes rivales
  (y el compañero en `solo`); al sustituir a un humano que se va, se usa un personaje neutro.
- **Turno de 30 s**: timer en servidor; el cliente solo muestra una cuenta atrás con `deadline` enviado por el servidor.
- Al terminar la partida: persistir resultado + log de eventos vía API interna (o directamente con Prisma
  desde un módulo compartido de persistencia; decidir en ADR en H3).

## 8. API (`apps/api`)

- Módulos NestJS: `auth`, `users`, `rooms` (listado/creación si no lo gestiona Colyseus), `matches`,
  `ranking`, `progression` (XP), `health`.
- **Auth**:
  - Email + contraseña (hash **argon2id**), verificación de email (puede ser stub de log en dev).
  - Google OAuth 2.0 (Passport). Vincular por email verificado.
  - **Invitado**: crea identidad temporal con apodo; puede jugar todo **excepto que no puntúa en ranking ni XP**.
  - Access token JWT corto (15 min) + refresh token rotatorio en cookie `httpOnly; Secure; SameSite=Lax`.
  - El cliente pide a la API un **ticket de juego** (JWT de 60 s) para unirse a Colyseus; `game` lo verifica.
- Seguridad: Helmet, CORS restringido, rate-limit (`@nestjs/throttler` + Redis), validación Zod en todos los DTOs,
  CSRF protegido por SameSite + cabecera custom, mensajes de error que no filtren información.
- **Ranking** (modelo PokerArena): **solo** las partidas `ranked` (cola clasificatoria) mueven el ELO.
  Las salas públicas y privadas son casuales: cuentan para estadísticas y XP, no para ELO.
  - Rating individual tipo **ELO** (K=32; K=40 en las 20 primeras partidas clasificatorias), calculado sobre la
    media de la pareja rival. ELO inicial 1200. Se muestra como número (como Chess.com) + su variación tras cada partida (+12 / −9).
  - **Temporadas** mensuales: clasificación por temporada (top 100 + tu posición), al cerrar la temporada se
    archivan los resultados y el ELO se comprime suavemente hacia 1200 (`nuevo = 1200 + (elo − 1200) × 0.75`).
  - **Insignias de temporada** según la posición final (p. ej. top 1, top 10, top 100). Se guardan en el perfil.
    El modelo se crea en H7; las insignias como recompensa estética visible llegan con la fase de cosméticos.
  - Perfil público: avatar, nombre, ELO actual y máximo, gráfico de ELO, partidas, % victorias, órdagos ganados,
    historial de partidas y de temporadas.
- **XP**: por partida jugada/ganada (solo usuarios registrados). Las recompensas estéticas son fase futura:
  dejar el modelo preparado (`Cosmetic`, `UserCosmetic`) pero sin UI.

### Modelo de datos inicial (Prisma, orientativo)
`User`, `OAuthAccount`, `RefreshToken`, `GuestIdentity`, `Rating`, `Match`, `MatchParticipant`,
`HandLog` (eventos JSONB), `XpEvent`, `Season`, `SeasonStanding`, `Badge`, `UserBadge`, `BotPersona`,
`Cosmetic`, `UserCosmetic`.
**Preparado para el futuro (no implementar aún)**: `Wallet`, `LedgerEntry` (doble entrada, inmutable).

## 9. Tests

- `engine`: unit tests por regla + **property-based** (fast-check). Invariantes mínimos:
  - Siempre hay 40 cartas entre manos, mazo y descartes; ninguna duplicada.
  - Los tantos nunca disminuyen; ninguna pareja supera 40 sin cerrar el juego.
  - `getLegalActions` nunca vacío para el jugador en turno; cualquier acción legal aplica sin error.
  - Partidas completas aleatorias (bots aleatorios) terminan siempre.
- `bots`: simulación de **≥ 10.000 partidas** bot vs bot sin excepciones; el bot medio gana claramente al bot aleatorio.
- `game`: tests de integración con `@colyseus/testing`: asientos, inicio, timeout, reconexión,
  espectadores, límite de 5, sala privada con código, **test de fuga de información** (inspeccionar todo
  lo que recibe cada cliente y espectador y comprobar que no contiene cartas ajenas).
- `game` (clasificatoria): tests del emparejador con relojes simulados: agrupa por ELO, amplía la ventana con
  la espera, respeta las parejas que entran juntas, nunca mete bots, no empareja a un jugador consigo mismo.
- `api`: tests de integración con Postgres de test (Docker) y supertest.
- `web`: tests de componentes críticos (Vitest + Testing Library) y **e2e Playwright**: registro, crear sala,
  jugar una mano completa contra bots, modo espectador.
- CI rompe si: falla un test, baja la cobertura del motor de 95 %, hay errores de tipos o lint, o gitleaks detecta algo.

## 10. Frontend (`apps/web`)

- Pantallas: **Portada**, **Login/Registro**, **Lobby + listado de partidas**, **Sala de espera (4 asientos)**,
  **Mesa de juego**, **Perfil y ranking**, **Tutorial**.
- **Responsive** desde el principio (móvil vertical, tablet, escritorio). Mesa cenital que se adapta:
  en móvil, la mano propia abajo grande, compañero arriba, rivales a los lados compactos.
- Estado de juego en un store Zustand alimentado **solo** por mensajes del servidor.
- La UI deshabilita acciones ilegales usando `legalActions` enviado por el servidor (no las calcula).
- Envites visibles de dos formas: **bocadillo sobre el avatar** del que habla + **panel central** con el lance en curso y la apuesta.
- Tantos con **amarracos visuales** (además de marcador numérico accesible).
- Turno: **anillo de cuenta atrás** alrededor del avatar.
- Sonidos: barajar, repartir, aviso de turno. **Botón de silencio** persistente (localStorage con try/catch).
- Accesibilidad: navegable por teclado, `aria-live` para anuncios de lance/envite, contraste AA,
  respetar `prefers-reduced-motion`.
- **Desde H4**: la UI se construye siguiendo el **archivo de Figma de 31mus** (§13): tema oscuro, estructura y
  componentes. **Fase 2**: animaciones vistosas, baraja definitiva y creador de avatares.
- Pantallas adicionales por el modelo de ranking: **Jugar** (elegir clasificatoria / casual / contra bots),
  **Buscando partida** (cola con tiempo de espera y ventana de ELO), **Resultado** (variación de ELO),
  **Clasificación de temporada**. Y por los bots: **selector de bot** con su personaje y estilo.

## 11. Seguridad y repositorio público

- `.gitignore` debe cubrir como mínimo: `node_modules/`, `dist/`, `build/`, `.turbo/`, `coverage/`,
  `.env`, `.env.*` (excepto `!.env.example`), `*.log`, `.DS_Store`, `.idea/`, `.vscode/` (salvo configs compartidas),
  `playwright-report/`, `test-results/`, volúmenes de Docker locales, `*.pem`, `*.key`.
- **Nunca** escribir secretos en código, tests, docs ni commits. Variables en `.env` (local) y secretos de
  GitHub Actions. `.env.example` con valores ficticios y comentarios.
- gitleaks en pre-commit y CI. Si detecta algo: no forzar, avisar al usuario.
- Dependencias: `pnpm audit` en CI; Dependabot semanal.
- Rate-limit en login, registro, unión a salas privadas, chat y reacciones.
- Cookies seguras, CSP estricta en producción (Caddy), sin `dangerouslySetInnerHTML`.
- Anti-trampas: el servidor rechaza acciones fuera de turno, ilegales o duplicadas (idempotencia por `actionId`).

## 12. Recursos gráficos y de sonido de terceros

- La **baraja española de Fournier no se puede copiar** (derechos). Usar una baraja española **libre**
  de aspecto clásico, p. ej. la de Wikimedia Commons de *Basquetteur* (`Baraja española.svg`).
  **Antes de usarla, verificar su licencia exacta** y cumplirla (atribución / share-alike) en `assets/cards/LICENSE.md`
  y en una página de créditos de la web.
- Sonidos: solo CC0 o con licencia compatible, registrados en `assets/sounds/LICENSE.md`.
- Todo recurso de terceros vive en `assets/` con su licencia junto a él. El código del proyecto es
  "todos los derechos reservados"; los assets de terceros mantienen su propia licencia.
- Avatares: **sistema propio** de avatares por capas SVG (estilo personaje ilustrado tipo "memoji"),
  sin usar recursos de Apple. En Fase 1, placeholder con iniciales.

## 13. Dirección visual

- **Fuente de verdad visual: el archivo de Figma de 31mus** (enlace en `docs/DISENO.md`). Sus variables se
  vuelcan a `packages/design-tokens`. No inventar colores, tipografías ni espaciados fuera de las variables.
  El **Design System de 31mus en Claude** (enlace en `docs/DISENO.md`) es un espejo legible de Figma:
  tokens, normas de uso y componentes en HTML/CSS. Sirve de apoyo cuando no se pueda leer Figma por el MCP;
  si alguna vez no coinciden, manda Figma.
- **Estilo**: interfaz **oscura**, sólida y profesional, en la línea de usabilidad de Chess.com / Gambit:
  la mesa (tapete) es la protagonista en el centro; barras de jugador con avatar, nombre y ELO; panel lateral
  con pestañas (Jugar, Partidas, Chat); botones con volumen (borde inferior más oscuro) que invitan a pulsar.
  **Identidad propia**: paleta, tipografía y formas de 31mus, nunca las de Chess.com.
- Las cartas son opacas y nítidas. Animaciones **vistosas** (reparto, descarte, volteo, órdago, victoria)
  en Fase 2 con Motion, desactivables con `prefers-reduced-motion`.
- Nombre provisional: **31mus**. Logo: lo aportará el usuario más adelante (dejar hueco en cabecera).
- Al implementar pantallas desde Figma, usar la skill `figma:figma-design-to-code` (§15).

## 14. Forma de trabajar (protocolo de hitos)

Al empezar una sesión:
1. Leer `CLAUDE.md`, `docs/HITOS.md` y, si aplica, `docs/REGLAS_MUS.md` y `docs/ARQUITECTURA.md`.
2. Identificar el **hito en curso** (el primero no marcado como ✅).
3. Proponer al usuario un **plan breve** del hito (tareas, archivos, riesgos) y esperar su OK.

Durante el hito:
- Trabajar en la rama del hito, con commits pequeños.
- Ejecutar `pnpm lint && pnpm typecheck && pnpm test` antes de cada commit.
- Si aparece una ambigüedad de reglas o de producto: **parar y preguntar**, no suponer.
- Decisiones técnicas relevantes → ADR corto en `docs/adr/`.

Al cerrar el hito:
1. Verificar la **Definición de Hecho** del hito en `HITOS.md`.
2. Actualizar `HITOS.md` (estado, notas, deuda técnica detectada) y `ARQUITECTURA.md` si cambió algo.
3. Resumir al usuario: qué se hizo, cómo probarlo (comandos exactos), qué queda pendiente.
4. **Parar** y esperar revisión antes de empezar el siguiente hito.

Nunca:
- Empezar un hito sin cerrar el anterior.
- Desactivar tests, bajar umbrales de cobertura o añadir `// @ts-ignore` / `eslint-disable` sin justificarlo y avisar.
- Implementar funcionalidades de fases futuras (monedas, cosméticos, frases de reacción) salvo que el usuario lo pida.

## 15. Skills y plugins permitidos

Usa **solo** las skills y plugins de esta lista, en el momento indicado. Si una tarea parece necesitar
otra, **pregunta antes**. Si dos skills hacen lo mismo, usa la que indica esta tabla.

### Siempre activos
| Plugin | Uso |
|---|---|
| **Security Guidance** (hooks) | Funciona solo al editar y al terminar. No lo desactives. Si avisa de algo, arréglalo antes de hacer commit. |

### Por momento del trabajo
| Cuándo | Skill / plugin | Para qué |
|---|---|---|
| Al tomar una decisión técnica relevante (todos los hitos) | `engineering:architecture` | Redactar el ADR en `docs/adr/` |
| Al planificar los tests de un hito (H1, H2, H3, H6, H9) | `engineering:testing-strategy` | Plan de tests antes de escribirlos |
| Ante un error cuya causa no es obvia | `engineering:debug` | Reproducir → aislar → diagnosticar → arreglar |
| **Al cerrar cada hito**, antes de pedir revisión a Antonio | `code-review:code-review` | Revisión del PR del hito. **Es la única skill de revisión de código**: no usar `engineering:code-review` |
| Al cerrar H6, H7, H9 y siempre que cambien tipos compartidos, DTOs o el esquema de Prisma | `api-drift-detector` (`/check-drift`) | Detectar desajustes de tipos entre web, api, game y Prisma |
| H9 (endurecimiento) y antes de H10 | `claude-security:claude-security` | Escaneo profundo del repositorio y propuestas de parche. **No** usarlo en cada hito: es costoso |
| H9 y al revisar deuda técnica entre fases | `engineering:tech-debt` | Inventario y priorización de deuda |
| H10 (despliegue) | `engineering:deploy-checklist` | Checklist previo a producción |
| Documentación (README, ARQUITECTURA, guías de despliegue) | `engineering:documentation` | Redacción técnica |

### Interfaz y diseño (H4, H5, H8 y toda la Fase 2)
| Cuándo | Skill | Para qué |
|---|---|---|
| **Al implementar cualquier pantalla o componente diseñado en Figma (H4, H5, H7, H8)** | `figma:figma-design-to-code` | Leer el diseño de Figma (`get_design_context`) y adaptarlo al código usando los tokens. **Obligatoria antes de llamar a `get_design_context`** |
| Al volcar las variables de Figma a `packages/design-tokens` (H4) | `design-skills:design-systems` | Tokens, nombres y documentación de componentes |
| Si una pantalla no tiene diseño en Figma todavía | `frontend-design:frontend-design` | Dirección visual coherente con lo ya diseñado; **preguntar antes** a Antonio |
| Al pulir el aspecto final (Fase 2) | `design-skills:design-elevation` | Pulido visual. Respeta los tokens; no inventes otros |
| Animaciones, estados, flujo de envites, feedback de turno | `design-skills:interaction-design` | Microinteracciones y máquinas de estado de la UI |
| Textos de UI: botones, errores, tutorial, estados vacíos | `design-skills:ux-writing` | Microcopy en español |
| Al cerrar H4, H5, H8, E2 y E3 | `design-skills:accessibility-audit` | Auditoría WCAG 2.2 AA. Prioridad: contraste de texto y controles sobre el tema oscuro. **Es la única skill de accesibilidad**: no usar `design:accessibility-review` |
| Tras cada pantalla terminada | `design-skills:design-critique` | Crítica heurística. **Es la única skill de crítica**: no usar `design:design-critique` |

### No usar en este proyecto
- `humanize-writing`, `marketing:*`, `finance:*`, `data:*`, `productivity:*`, `pdf-viewer:*`,
  `infrastructure-change-readiness:*`, el generador de logos de ManyMotions
  (el logo lo hace Antonio) y cualquier `figma:*` distinto de `figma-design-to-code`
  (no escribir en el archivo de Figma: el diseño lo mantiene Antonio).
- Ninguna skill o plugin que no aparezca en esta sección.

## 16. Comandos

Definidos en H0:

```bash
pnpm install
pnpm dev              # docker compose (postgres, redis) + todas las apps en watch
pnpm test             # todos los tests (el motor exige cobertura ≥ 95 %)
pnpm test:engine      # solo motor
pnpm lint             # ESLint + reglas de dependencias (lint:deps) + Prettier
pnpm typecheck
pnpm build
pnpm format           # Prettier --write
pnpm infra:up         # solo PostgreSQL y Redis (docker compose up -d --wait)
pnpm infra:down
```

Se añaden en su hito:

```bash
pnpm test:e2e         # Playwright (H5)
pnpm db:migrate       # prisma migrate dev (H6)
pnpm db:seed          # (H6)
docker compose -f docker-compose.prod.yml up -d --build   # (H10)
```

## 17. Desarrollo en Windows

El entorno de desarrollo es **Windows nativo**: PowerShell 7, Docker Desktop (backend WSL2) y Git for Windows.

- **Scripts de `package.json` multiplataforma**: pnpm los ejecuta con `cmd.exe`. Nada de `rm -rf`,
  `export VAR=…`, `$(…)` ni comillas simples de bash. `&&` sí funciona. Si hace falta lógica,
  un script de Node en `infra/scripts/`.
- **Finales de línea**: `.gitattributes` fuerza LF (salvo `*.ps1`, `*.cmd` y `*.bat`, en CRLF). Mantener
  `core.autocrlf=false`.
- **Hooks de Husky**: los ejecuta el `sh` de Git for Windows. Escribirlos en sh POSIX.
- **gitleaks** es obligatorio en local (`winget install --id Gitleaks.Gitleaks`). Sin él, el pre-commit falla.
- **Docker Desktop debe estar arrancado** antes de `pnpm dev` o `pnpm infra:up`. Los puertos se publican
  solo en `127.0.0.1`.
- **`.env`**: `Copy-Item .env.example .env`. `docker compose` falla con un mensaje claro si faltan variables.
- **Las apps escuchan en `127.0.0.1`** por defecto, para que no salte el Firewall de Windows. En contenedores, `HOST=0.0.0.0`.
- **Puerto ocupado** tras cerrar `pnpm dev` a la fuerza:
  `Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess }`.
- **Telemetría de Turborepo** (anónima): se desactiva con `pnpm exec turbo telemetry disable`. En CI ya está desactivada.
- Rutas en código y configuración siempre con `/` o `path`/`URL`, nunca `\` a mano.
