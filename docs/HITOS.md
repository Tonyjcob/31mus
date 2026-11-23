# Hitos de 31mus

> Claude Code trabaja **un hito cada vez** (ver protocolo en `CLAUDE.md` §14).
> Estados: ⬜ pendiente · 🟡 en curso · ✅ cerrado (aprobado por Antonio).
> Cada hito tiene una **Definición de Hecho (DoD)**: si no se cumple entera, el hito no se cierra.

---

## Decisiones de producto (confirmadas el 19/11/2026)

| # | Decisión | Resuelto |
|---|---|---|
| D1 | Tiempo agotado en el mus o en el descarte | "No hay mus" / descartar 1 carta (la peor según el bot) |
| D2 | "No quiero" en pares o juego | La pareja que envidó cobra el deje **y** sus jugadas en el recuento |
| D3 | Mínimo de un reenvido | 1 tanto |
| D4 | Mus corrido | No: mus normal desde la primera mano |
| D5 | Ranking | Modelo PokerArena: **solo la cola clasificatoria 2 vs 2 mueve el ELO**; las salas son casuales. ELO individual, inicial 1200, K=32 (K=40 en las 20 primeras), sobre la media de la pareja rival. Temporadas mensuales con clasificación e insignias (20/11/2026) |
| D6 | Invitados | Pueden jugar salas casuales (públicas, privadas y contra bots). **No** pueden entrar en la clasificatoria |
| D7 | Reconexión | El jugador puede recuperar su asiento durante toda la partida; mientras tanto juega un bot |
| D8 | Estética | Interfaz **oscura** al estilo de usabilidad de Chess.com / Gambit, con identidad propia. Fuente de verdad: archivo de Figma de 31mus (20/11/2026) |
| D9 | Bots | Bots **con personaje** (nombre, avatar y estilo), todos de dificultad media (20/11/2026) |

---

## FASE 1 — Jugable y robusto

### ✅ H0 · Cimientos del repositorio
Monorepo pnpm + Turborepo, paquetes vacíos con su configuración, TS strict, ESLint, Prettier, Husky,
lint-staged, commitlint, gitleaks, Vitest base y `docker-compose.yml` (Postgres + Redis).
También: `.gitignore`, `.env.example`, `LICENSE` (todos los derechos reservados), README,
`docs/ARQUITECTURA.md`, ADR-0001 (stack), CI en GitHub Actions y Dependabot.

**DoD**
- `pnpm install && pnpm dev` levanta Postgres y Redis y las apps arrancan con un "hola".
- `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan en local y en CI.
- gitleaks bloquea un secreto de prueba (probarlo y revertirlo).
- Las reglas de dependencias entre paquetes se validan automáticamente.

**Notas de cierre (23/11/2026, aprobado por Antonio)**
- DoD verificada: `pnpm dev` levanta PostgreSQL 18 + Redis 8 y web/api/game responden; lint, typecheck,
  test, build y `pnpm audit` en verde en local y en CI (PR #1); gitleaks bloqueó un token de prueba;
  dependency-cruiser y ESLint rechazaron imports prohibidos y `Math.random` en el motor.
- Decisiones en `docs/adr/ADR-0001-stack.md`. `api` y `game` son `node:http` hasta H6/H3.
- `/code-review` del PR: 10 hallazgos; 9 corregidos (caché de turbo, entorno de web con Zod,
  rutas y HEAD en los servidores, cooldown de Dependabot…). El restante queda como deuda (abajo).

**Deuda técnica detectada**
- TypeScript 7 (nativo) pendiente de que lo soporten typescript-eslint y dependency-cruiser.
- Logs estructurados con pino (§5): se introducen con NestJS (H6) y Colyseus (H3).
- PostgreSQL 19: subir cuando Prisma lo soporte (H6).
- Redis de desarrollo sin contraseña (solo en 127.0.0.1); producción con contraseña en H10.
- `tsx watch` reinicia api/game una vez al arrancar `pnpm dev` (los paquetes recompilan). Inofensivo.
- `apps/api/src/server.ts` y `apps/game/src/server.ts` están duplicados. Se acepta porque son
  provisionales: desaparecen con NestJS (H6) y Colyseus (H3).
- Comprobar que Dependabot procesa bien el lockfile de pnpm 12 en su primera ejecución.
- Proteger la rama `main` en GitHub (PR obligatorio + checks de CI).
- Skills de la §15 no instaladas en esta sesión: `engineering:*` y `design-skills:*`. El ADR-0001 se
  redactó sin `engineering:architecture`.

### ⬜ H1 · Motor de reglas (`packages/engine`)
Cartas, baraja, RNG inyectable, reparto, mus y descartes, rebarajado de descartes, evaluadores
(grande, chica, pares, juego, punto), declaraciones, máquina de estados de lances, envites
(envido, envido N, reenvido, quiero, no quiero, órdago y deje), recuento ordenado con corte a 40,
juegos al mejor de 3, rotación de la mano, `getLegalActions`, `getView` (filtrado),
`getTimeoutAction` y log de eventos.

**DoD**
- Implementa todo `REGLAS_MUS.md`, según las decisiones D1–D4.
- Cobertura ≥ 95 % y tests de propiedades de los invariantes (`CLAUDE.md` §9).
- 1.000 partidas completas con jugadores aleatorios terminan sin errores.
- Una tabla de casos de evaluación (≥ 60 manos) revisada por Antonio.

### ⬜ H2 · Bots (`packages/bots`)
Bot de dificultad **media**: evalúa la fuerza de la mano por lance, decide el mus y los descartes,
envida y acepta con umbrales, se tira **faroles** con probabilidad controlada y rara vez lanza órdagos.
Tiene en cuenta el marcador (más agresivo cerca de 40). También un bot aleatorio como referencia
para los tests y un retardo "humano" configurable (1–3 s; lo aplica el servidor, no el bot).

**Personajes** (`BotPersona`): mismo nivel, distinto estilo. Catálogo inicial (nombres y textos a validar por Antonio):

| Personaje | Estilo |
|---|---|
| **El Abuelo** | Conservador. Casi nunca va de farol, quiere con jugada segura. |
| **La Faraona** | Agresiva. Envida mucho y lanza órdagos con facilidad. |
| **El Pollo** | Faroles constantes; envida fuerte con manos flojas. |
| **Doña Rosario** | Paciente. Pide mus hasta encontrar mano; muy sólida en pares y juego. |
| **Neutro (Bot)** | Equilibrado. Sustituye a los humanos que se desconectan. |

**DoD**
- 10.000 partidas bot contra bot sin errores.
- La pareja de bots medios gana al menos el 70 % de las partidas contra la pareja de bots aleatorios.
- Los faroles aparecen con una frecuencia medida y documentada.
- Cada personaje tiene un estilo medible distinto (frecuencia de envite, farol y órdago) y ninguno gana a otro
  más del 60 % de las veces en 5.000 partidas (mismo nivel, distinto estilo).

### ⬜ H3 · Servidor de juego (`apps/game`)
`MusRoom` en Colyseus, con los modos `solo`, `duo_vs_bots` y `2v2`. Asientos, inicio cuando se llenan,
temporizador de 30 s con `deadline` y bots que sustituyen a quien se va. Reconexión con recuperación
del asiento, espectadores (máximo 5), chat común y reacciones con rate-limit, salas privadas con
código, idempotencia de acciones y persistencia del log de cada mano (ADR sobre cómo persistir). Aplica D7.

**DoD**
- Tests de integración de todos los flujos de `CLAUDE.md` §7.
- **Test de fuga de información** en verde: ningún mensaje a un cliente o espectador contiene cartas ajenas.
- Se puede jugar una partida completa con un cliente de pruebas por consola o con un script.

### ⬜ H4 · Mesa jugable (`apps/web`, parte 1)
**Requisito previo:** pantallas de mesa (escritorio y móvil) aprobadas por Antonio en Figma.
Primero: volcar las variables de Figma a `packages/design-tokens`. Implementar con `figma:figma-design-to-code`.

Mesa cenital responsive: mano propia, compañero y rivales, fases y lances. Panel de acciones
alimentado por `legalActions`, envites con bocadillo y panel central, amarracos con marcador
numérico, anillo de turno, chat y reacciones flotantes, y revelado y recuento al final de la mano.
Sonidos (barajar, repartir, turno) y botón de silencio. Tema oscuro según Figma,
y la baraja libre ya integrada con su licencia verificada. Selector de personajes de bot para el modo solo.

**DoD**
- Modo **solo** jugable de principio a fin en escritorio y en móvil.
- Navegable con el teclado, con anuncios `aria-live` y `prefers-reduced-motion` respetado.

### ⬜ H5 · Lobby, salas y espectador (`apps/web`, parte 2)
**Requisito previo:** pantallas de inicio, Jugar y lobby aprobadas en Figma.

Portada, lobby con el listado de partidas en curso (pública o privada con candado, modo, asientos y
número de espectadores), creación de salas (modo y visibilidad), unirse con código, sala de espera
con los 4 asientos y modo espectador. Aplica D6.

**DoD**
- E2E Playwright: crear una sala privada, unirse con el código, llenarla, jugar y entrar como espectador.
- Funciona en el móvil.

### ⬜ H6 · API y autenticación (`apps/api`)
Registro y login con email (argon2id y verificación en modo stub), Google OAuth, invitados,
JWT y refresh rotatorio, ticket de juego para Colyseus, perfil básico (apodo y avatar provisional),
Prisma con las migraciones del modelo inicial, throttling, Helmet y CORS.

**DoD**
- Tests de integración de la autenticación (incluidos los casos de error y el rate-limit).
- El servidor de juego rechaza a quien no tiene ticket válido.
- Ningún secreto en el repo; `.env.example` completo.

### ⬜ H7 · Clasificatoria, ranking y temporadas (modelo PokerArena)
Cola clasificatoria 2 vs 2 en el servidor de juego (solo o con pareja, ventana de ELO que se amplía con la espera,
nunca bots), pantallas **Jugar → Buscando partida → Mesa → Resultado (+/− ELO)**. Persistencia de partidas,
ELO según D5, XP por partida, **temporadas** mensuales (clasificación, cierre, compresión de ELO, insignias por
posición), página de clasificación de temporada y perfil con estadísticas, gráfico de ELO e historial.
Modelos `Season`, `SeasonStanding`, `Badge`, `UserBadge`, `Cosmetic` y `UserCosmetic` creados.
**Requisito previo:** pantallas de clasificatoria, resultado, clasificación y perfil aprobadas en Figma.

**DoD**
- Tests del emparejador (relojes simulados), del cálculo de ELO, XP y del cierre de temporada.
- Los invitados no pueden entrar en la cola; las salas casuales nunca mueven el ELO.
- Simulación con 200 jugadores en cola: todos emparejados en < 90 s con diferencia media de ELO < 150.
- El ranking aguanta 10.000 usuarios de seed sin degradarse (con índices).

### ⬜ H8 · Tutorial
Partida guiada contra bots con manos predefinidas (semilla fija). Pasos explicativos para el mus,
cada lance, los envites, el órdago y el recuento. Se puede saltar y repetir. Se ofrece en la portada.

**DoD**
- Se completa de principio a fin en el móvil y en escritorio.
- E2E en verde.

### ⬜ H9 · Endurecimiento
Batería e2e completa, prueba de carga (50 salas simultáneas con bots), pruebas de desconexión
y caos (matar el servidor de juego a mitad de partida y documentar el comportamiento), revisión de
seguridad (OWASP básico), barrido de accesibilidad y revisión del rendimiento en el móvil.

**DoD**
- Sin errores críticos abiertos.
- Informe en `docs/INFORME_H9.md`.

### ⬜ H10 · Despliegue
`docker-compose.prod.yml`, Caddy con HTTPS, guía de Cloudflare Tunnel para pruebas desde el PC,
guía de despliegue en una VM gratuita de Oracle Cloud, backups de Postgres y healthchecks.

**DoD**
- Antonio despliega siguiendo la guía sin ayuda y juega con 3 amigos.

---

## FASE 2 — Estética (después de cerrar la Fase 1)

### ⬜ E1 · Pulido visual
Revisión pantalla a pantalla contra Figma: estados, micro-detalles, iconografía final, logo de Antonio.

### ⬜ E2 · Avatares de los bots
Ilustraciones definitivas de cada personaje de bot, en el mismo estilo que el creador de avatares.

### ⬜ E3 · Animaciones vistosas
Reparto, descarte, volteo, órdago y victoria.

### ⬜ E4 · Baraja final y reverso propio con la marca 31mus.

### ⬜ E5 · Avatares
Creador propio por capas SVG, del estilo de un personaje ilustrado.

### ⬜ E6 · Pulido de sonido
Mezcla de volúmenes y sonidos adicionales.

## FASE 3 — Futuro (no empezar sin especificación)
- Monedas virtuales (cartera, libro de movimientos de doble entrada y mesas con entrada).
- Recompensas estéticas canjeables con XP o monedas, incluidas las insignias y avatares de temporada.
- Frases de mus como reacciones.
- Logo definitivo (lo aporta Antonio).
