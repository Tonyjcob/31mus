# Hitos de 31mus

> Claude Code trabaja **un hito cada vez** (ver protocolo en `CLAUDE.md` §14).
> Estados: ⬜ pendiente · 🟡 en curso · ✅ cerrado (aprobado por Antonio).
> Cada hito tiene una **Definición de Hecho (DoD)**: si no se cumple entera, el hito no se cierra.

---

## Decisiones de producto

D1–D9 confirmadas el 19 y el 20/11/2026; D10–D16, el 23/11/2026; D17–D22, el 24/11/2026. Criterio para las reglas: **reglamentos
oficiales** (FEM y La Federación; Las40 como referencia online), no costumbres de mesa.

| # | Decisión | Resuelto |
|---|---|---|
| D1 | Tiempo agotado en el mus o en el descarte | "Corto" / descartar 1 carta (cuál, en D15) |
| D2 | "No quiero" en pares o juego | La pareja que envidó cobra la negada o el deje **y** sus jugadas en el recuento |
| D3 | Mínimo de un reenvido | 1 tanto |
| D4 | Mus corrido | No: mus normal desde la primera mano |
| D5 | Ranking | Modelo PokerArena: **solo la cola clasificatoria 2 vs 2 mueve el ELO**; las salas son casuales. ELO individual, inicial 1200, K=32 (K=40 en las 20 primeras), sobre la media de la pareja rival. Temporadas mensuales con clasificación e insignias (20/11/2026) |
| D6 | Invitados | Pueden jugar salas casuales (públicas, privadas y contra bots). **No** pueden entrar en la clasificatoria |
| D7 | Reconexión | El jugador puede recuperar su asiento durante toda la partida; mientras tanto juega un bot |
| D8 | Estética | Interfaz **oscura** al estilo de usabilidad de Chess.com / Gambit, con identidad propia. Fuente de verdad: archivo de Figma de 31mus (20/11/2026) |
| D9 | Bots | Bots **con personaje** (nombre, avatar y estilo), todos de dificultad media (20/11/2026) |
| D10 | Rebarajado de descartes | Se reparte lo que quede del mazo y después se barajan **todos** los descartes, también los de esa ronda. Durante la decisión de mus, si el mazo tiene **menos de 16 cartas**, se avisa a toda la mesa ("puede que se barajen los descartes"); el aviso desaparece al rebarajar o al cortar |
| D11 | Fase de mus | Secuencial: mano → 2.º → 3.º → postre; cada uno dice "mus" o "corto" y **cualquiera puede cortar** (FEM V.4). Tras cortar, la grande empieza **siempre por la mano**. Atajo de UI "Corto y envido" solo para la mano |
| D12 | Respuesta a un envite (FEM VI.2–4) | Responde el siguiente rival y **su compañero habla siempre después**, salvo que el primero haya subido u ordagado; puede querer, subir u ordagar aunque el primero haya querido. Prioridad: subida u órdago > quiero > no quiero. El compañero de quien envidó no puede subir hasta que suban los rivales. Tiempo agotado del segundo rival = se mantiene la respuesta de su compañero |
| D13 | Envite rechazado | En grande, chica y punto **solo se cobra lo rechazado** (en pares y juego, D2). Nombres: **negada** = el tanto por rechazar la primera apuesta del lance; **deje** = lo cobrado al rechazar una subida |
| D14 | Apuesta máxima | **40 tantos** en total por lance; para más, órdago |
| D15 | Descarte por tiempo agotado | La primera carta que **no forme pareja** en el orden 4, 5, 6, 7, S, C, A, R; si todas forman jugada, la primera en ese mismo orden |
| D16 | Fin de mano | **Los cuatro enseñan todas sus cartas** (LaFed art. 69), también con órdago aceptado. Grande y chica en paso: 1 tanto al ganador en el recuento |
| D17 | Espectadores al final de la mano | Ven las cartas que enseñan los cuatro (D16), igual que los jugadores. Antes del fin de mano, ninguna carta (24/11/2026) |
| D18 | Persistencia del log de manos | `game` escribe directamente en PostgreSQL mediante un paquete de BD compartido con `api` (`packages/db`, H6); cambia las reglas de dependencias de CLAUDE.md §4. En H3, memoria y ficheros (ADR-0004) |
| D19 | Pausa entre manos | La siguiente mano empieza sola a los 8 s, sin botón «listo» |
| D20 | Sala sin humanos conectados | La partida se pausa; si nadie vuelve en 10 min, se cierra y se guarda como abandonada. Con al menos un humano, los bots juegan por los ausentes (D7) |
| D21 | Chat, reacciones y salas privadas | Reacciones 👏 😂 😮 😡 🔥 👍 👎 🤔; chat 5 mensajes / 10 s; reacciones 3 / 5 s; código de 6 caracteres sin 0/O/1/I/L; 5 intentos fallidos por minuto |
| D22 | Personajes sorteados | Los bots que no se eligen se sortean solo entre los 4 personajes con nombre. El neutro («Bot») se puede elegir, pero no sale por sorteo: es el que sustituye a quien se va (D7) |

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

### ✅ H1 · Motor de reglas (`packages/engine`)
Cartas, baraja, RNG inyectable, reparto, mus y descartes, rebarajado de descartes, evaluadores
(grande, chica, pares, juego, punto), declaraciones, máquina de estados de lances, envites
(envido, envido N, reenvido, quiero, no quiero, órdago, negada y deje), recuento ordenado con corte a 40,
juegos al mejor de 3, rotación de la mano, `getLegalActions`, `getView` (filtrado),
`getTimeoutAction` y log de eventos.

**DoD**
- Implementa todo `REGLAS_MUS.md`, según las decisiones D1–D4 y D10–D16.
- Cobertura ≥ 95 % y tests de propiedades de los invariantes (`CLAUDE.md` §9).
- 1.000 partidas completas con jugadores aleatorios terminan sin errores.
- Una tabla de casos de evaluación (≥ 60 manos) revisada por Antonio.

**Notas de cierre (24/11/2026, aprobado por Antonio)**
- DoD verificada: implementa REGLAS_MUS con D1–D4 y D10–D17; 182 tests con cobertura del 100 %;
  tests de propiedades (40 cartas sin duplicados, tantos que no bajan, turnos, legalidad de la acción
  por tiempo, fugas de información para jugadores y espectadores, inmutabilidad, ida y vuelta por JSON)
  y 1.000 partidas aleatorias completas; tabla de 62 casos revisada por Antonio (24/11/2026).
- Diseño en `docs/adr/ADR-0002-motor-de-reglas.md`; API en `docs/ARQUITECTURA.md` §7. D17 decidida al
  cerrar: los espectadores ven las cartas enseñadas al final de la mano.
- Decisiones menores dentro del ADR: los tantos se topan en 40 al cerrar el juego (también en el evento
  `pointsScored`); `createMatch` devuelve solo el estado, sin eventos del primer reparto;
  `MatchConfig.firstMano` es opcional (si falta, se sortea).
- `/code-review` del PR (#2): ningún hallazgo de peso. Se corrigieron tres detalles menores: tantos sin
  topar en el evento, una pareja pasada como asiento a `jugadaPoints` y un comentario desfasado.

**Deuda técnica detectada**
- El `Rng` de producción (`crypto.randomInt`) se implementa en `apps/game` (H3); el motor solo trae
  el de semilla para tests.
- Los eventos del motor no llevan marca de tiempo ni actor de sistema: el log persistido de §2.5 los
  completa en el servidor (H3).
- Primer reparto sin eventos: el servidor manda a cada jugador sus cartas desde `getView` al crear la
  partida (H3).

### ✅ H2 · Bots (`packages/bots`)
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

**Notas de cierre (24/11/2026, aprobado por Antonio)**
- DoD verificada con `pnpm --filter @31mus/bots sim` (resultados en `docs/bots/MEDICIONES.md`):
  10.000 partidas bot contra bot sin errores; el bot medio gana el 96,1 % al aleatorio en 5.000
  partidas; faroles medidos (del 4 % de los envites de El Abuelo al 22 % de El Pollo); estilos distintos
  en envites, faroles, órdagos, quieros y cortes; los enfrentamientos entre personajes quedan entre el
  46,6 % y el 54,6 % en 5.000 partidas cada uno.
- Diseño en `docs/adr/ADR-0003-bots.md`; API en `docs/ARQUITECTURA.md` §8. Personajes con los nombres y
  textos de esta tabla, aprobados con el plan. Simulaciones en dos niveles (CLAUDE.md §9).
- Calibración: el Bot neutro se ajustó para que llevar cualquier rasgo al extremo no gane claramente;
  los personajes se desvían de él sin descompensarse.
- `/code-review` del PR (#4): un error real y menor, corregido. Al valorar una mano sin juego para el
  mus y el descarte, el rival que no juega el punto contaba como derrotado, cuando lo que tiene es
  juego y gana él (`value.ts`). También se nombró el término medio de los rasgos (`NEUTRAL_TRAIT`).
  Simulación de la DoD repetida tras la corrección: ver `docs/bots/MEDICIONES.md`.

**Deuda técnica detectada**
- La fuerza de la mano no tiene en cuenta las cartas propias (que no pueden estar en otra mano) ni
  cuántas cartas descartó cada rival. Mejoraría el juego sin cambiar la API (ADR-0003).
- El bot solo lee el lance en curso: no recuerda quién envidó en lances anteriores ni la apuesta que
  quedó tapada por una subida.
- Los bots quieren poco (entre el 10 % y el 13 % de las respuestas): coherente entre ellos, pero falta
  comprobarlo contra humanos en las pruebas de H3 y H5.
- La simulación completa tarda unos 10 minutos y no corre en CI; valorar un trabajo nocturno.
- Los tests de `bots` tardan ~28 s con cobertura (la muestra de 3.000 partidas).

### 🟡 H3 · Servidor de juego (`apps/game`)
`MusRoom` en Colyseus, con los modos `solo`, `duo_vs_bots` y `2v2`. Asientos, inicio cuando se llenan,
temporizador de 30 s con `deadline` y bots que sustituyen a quien se va. Reconexión con recuperación
del asiento, espectadores (máximo 5), chat común y reacciones con rate-limit, salas privadas con
código, idempotencia de acciones y persistencia del log de cada mano. Aplica D7 y D17–D22.
Diseño en `docs/adr/ADR-0004-servidor-de-juego.md` (aceptado el 24/11/2026).

**DoD**
- Tests de integración de todos los flujos de `CLAUDE.md` §7.
- **Test de fuga de información** en verde: ningún mensaje a un cliente o espectador contiene cartas ajenas.
- Se puede jugar una partida completa con un cliente de pruebas por consola o con un script.

**Notas de cierre (25/11/2026, pendiente de la aprobación de Antonio)**
- DoD verificada:
  - Flujos de §7 con clientes reales del SDK: lobby y asientos, inicio por modo, personajes, sala
    privada con código y límite de intentos, espectadores (≤ 5, vista sin cartas), turno de 30 s con
    acción por tiempo agotado, idempotencia, caída y reconexión (misma sesión o nueva), bot que toma
    el asiento y lo devuelve, pausa sin humanos y cierre por abandono, chat y reacciones con límite.
    La clasificatoria es de H7.
  - Test de fuga en verde: partidas completas en `solo` con espectador y en `duo_vs_bots` con caídas
    y vueltas; busca cartas en todo el JSON que recibe cada cliente. Se comprobó que detecta una
    fuga provocada a propósito.
  - `pnpm --filter @31mus/game play:script` juega una partida entera (21 manos en ~16 s) y
    `pnpm --filter @31mus/game play` permite jugarla a mano contra `pnpm dev`.
- 91 tests en `game`; cobertura 98,2 % de sentencias y 94,3 % de ramas (umbral 90 %, sin `src/cli/` ni
  `main.ts`). Diseño en ADR-0004; arquitectura en `docs/ARQUITECTURA.md` §9.
- D22 (24/11): el sorteo de rivales es solo entre los cuatro personajes con nombre.
- `/code-review` de la rama: dos errores reales, los dos corregidos con su test (e93f55d).
  - Un jugador sentado que entraba en su sala como espectador (otra pestaña) dejaba el asiento
    «conectado» sin nadie: ningún bot lo tomaba y no había pausa ni cierre por abandono.
  - Al apagar el servidor se podía perder la línea `finish` de las partidas abandonadas.
  - Normas: sin incumplimientos. Solo se anotó que `@vitest/coverage-v8` entró en `game` sin
    justificarlo en el commit (es la misma dependencia que ya usan los paquetes).

**Deuda técnica detectada**
- Un solo proceso y sin Redis: rate-limits, presencia y salas en memoria (H7/H10).
- Si el proceso cae a mitad de partida, la partida se pierde; quedan guardadas las manos terminadas (H9).
- El log de partidas no tiene entrega garantizada: un fallo al escribir se registra y la partida sigue
  (se decide con Prisma en H6).
- La identidad es solo la de desarrollo; el ticket JWT llega en H6.
- `mus-room.ts` está en 297 líneas: lo nuevo de la sala debe ir en módulos aparte.
- Una caída en el lobby o de un espectador cuenta como salida (sin reconexión); solo se guarda la
  sesión de quien juega una partida en curso.
- Sigue pendiente comprobar contra humanos lo poco que quieren los bots (deuda de H2): pasa a H5.

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
