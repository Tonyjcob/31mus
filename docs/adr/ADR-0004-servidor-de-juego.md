# ADR-0004 · Diseño del servidor de juego (`apps/game`)

- **Estado:** aceptado (Antonio, 24/11/2026)
- **Fecha:** 24/11/2026
- **Hito:** H3 · Servidor de juego
- **Decide:** Antonio

## Contexto

H3 convierte `apps/game` (hoy un `node:http` con `/health`) en el servidor de partidas en tiempo real:
una `MusRoom` de Colyseus por mesa, con los modos `solo`, `duo_vs_bots` y `2v2`, asientos, turno de
30 s, bots que sustituyen a quien se va (D7), reconexión, espectadores (máx. 5, D17), chat, reacciones,
salas privadas con código, idempotencia de acciones y log de cada mano (CLAUDE.md §7, HITOS H3).

Restricciones que ya están fijadas:

- **El servidor es la autoridad** y **la información oculta nunca sale de él** (CLAUDE.md §2.1–2.2).
  Todo evento pasa por `getEventView` y toda vista por `getView` (ADR-0002).
- Barajado con `crypto.randomInt` en producción (§2.4); el `Rng` de producción vive en `apps/game`.
- **Todo se registra**: log de eventos inmutable por mano, persistido en BD (§2.5). La BD y Prisma
  llegan en H6.
- Los bots reciben solo `PlayerView` + acciones legales y el servidor aplica el retardo de 1–3 s
  (ADR-0003).
- La identidad real (ticket JWT de la API) llega en H6. La clasificatoria y Redis, en H7.
- Toda entrada externa se valida con Zod definido en `shared` (§5).
- **DoD**: tests de integración de todos los flujos de §7; test de fuga en verde; una partida completa
  jugable con un cliente de consola o un script.

Quedan por decidir: qué va en el estado sincronizado y qué en mensajes, cómo se organiza el código
para poder probar el tiempo, cómo se identifica al jugador hasta H6, dónde y cómo se persiste el log,
y los comportamientos de producto que §7 no fija (pausa entre manos, sala sin humanos, límites).

## Decisión

### 1. Estado público en el `Schema`; la partida, en mensajes por cliente

El `Schema` de Colyseus (sincronizado a **todos** los clientes de la sala) solo lleva datos públicos
de la mesa, nunca nada derivado de `MatchState` que pueda contener cartas:

```ts
class SeatSchema   { kind: 'empty' | 'human' | 'bot'; userId; nickname; personaId; connected }
class MusRoomState { mode; visibility; status: 'lobby' | 'playing' | 'paused' | 'finished';
                     seats: ArraySchema<SeatSchema>; spectators: number }
```

La partida se envía con mensajes dirigidos a cada cliente, construidos **solo** con las funciones de
filtrado del motor:

| Mensaje (servidor → cliente) | Contenido | Origen |
|---|---|---|
| `game:view` | `{ version, view, legal, deadline }` | `getView(state, viewer)`, `getLegalActions` |
| `game:events` | `{ version, events }` | `getEventView(event, viewer)` de cada evento, quitando los `null` |
| `game:actionResult` | `{ actionId, ok \| code }` | Respuesta a cada acción |
| `chat:message`, `reaction` | Mensaje sanitizado con autor y rol | Difusión a toda la sala |
| `room:you` | `{ role, seat, code }`: quién es el destinatario y, en salas privadas, el código | Al entrar y al cambiar de asiento |
| `room:error` | Código de error sin detalles internos | — |

- Un único módulo, `outbound.ts`, construye **todos** los mensajes de partida a partir del
  `Viewer` del destinatario. Ningún otro sitio llama a `client.send` con datos de la partida. Así el
  test de fuga tiene un único punto que vigilar y una forma de comprobarlo exhaustiva (§8).
- `deadline` es una marca de tiempo absoluta del servidor (ms); el cliente solo pinta la cuenta atrás.
- `legal` va vacío para espectadores y para quien no está en `pendingSeats`.
- Se descartan los filtros por cliente del `Schema` (`StateView`/`@view`): son correctos, pero mezclan
  datos públicos y privados en una misma estructura y el test de fuga tendría que entender el
  codificador de Colyseus. Con mensajes, lo que recibe cada cliente es JSON simple e inspeccionable.

### 2. La lógica de la mesa fuera de Colyseus (`MatchController`)

```
apps/game/src/
├─ main.ts                    # arranque: env, logger, servidor
├─ server.ts                  # Server de Colyseus + /health (sustituye al node:http de H0)
├─ rooms/mus-room.ts          # Adaptador fino: mensajes ↔ controlador, Schema, reconexión
├─ table/
│  ├─ match-controller.ts     # Orquesta la partida: acciones, turnos, bots, manos, fin
│  ├─ seating.ts              # Asientos, modos, quién falta para empezar
│  ├─ turn-timer.ts           # Deadline y acción por tiempo agotado
│  ├─ bot-driver.ts           # Turno de bot con retardo 1–3 s
│  └─ outbound.ts             # Único constructor de mensajes de partida (§1)
├─ chat/                      # Sanitizado y rate-limit de chat y reacciones
├─ private-code.ts            # Generación y comparación del código
├─ identity/                  # Puerto de identidad (§3)
├─ match-log/                 # Puerto MatchLogStore y adaptadores (§4)
├─ infra/rng.ts               # Rng con crypto.randomInt
├─ infra/scheduler.ts         # Puerto de tiempo: now(), setTimeout, clearTimeout
└─ cli/                       # Cliente de consola y script de partida (§9)
```

- `MatchController` no importa nada de Colyseus. Recibe por constructor un `Scheduler` (tiempo), un
  `Rng`, el `MatchLogStore`, un logger y un callback `send(viewer, message)`. Es testeable con un
  **reloj falso**: el turno de 30 s, el retardo de los bots, la pausa entre manos y el cierre por sala
  vacía se prueban sin esperar.
- `MusRoom` traduce: `onJoin`/`onLeave`/`onDrop`/`onReconnect` y los mensajes validados por Zod
  (`validate()` de Colyseus acepta esquemas Standard Schema, como los de Zod 4) llaman al
  controlador; en producción el `Scheduler` envuelve `this.clock` de la sala.
- El `Rng` de producción (`crypto.randomInt`) se usa para barajar, para los sorteos y para los bots
  (faroles y retardo). En tests se inyecta `createSeededRng`.

### 3. Identidad: puerto `IdentityVerifier`, stub de desarrollo hasta H6

```ts
interface Identity { userId: string; nickname: string; kind: 'user' | 'guest' }
interface IdentityVerifier { verify(joinOptions: unknown): Promise<Identity> }  // en onAuth
```

- **H3**: `DevIdentityVerifier` valida con Zod `{ userId, nickname }` enviados al unirse (apodo de
  1–20 caracteres, sanitizado). **Solo funciona fuera de producción**: con `NODE_ENV=production` el
  servidor se niega a arrancar si no hay un verificador real configurado.
- **H6**: `TicketIdentityVerifier` verifica el ticket JWT de 60 s de la API. La sala no cambia.
- La reentrada (D7) se decide por `userId`, no por la sesión de Colyseus: si el usuario vuelve desde
  otra pestaña o dispositivo, recupera su asiento igual.

### 4. Log de manos: puerto `MatchLogStore`; BD compartida desde H6

```ts
interface MatchLogStore {
  startMatch(meta: MatchMeta): Promise<void>
  appendHand(record: HandRecord): Promise<void>      // al terminar cada mano
  finishMatch(result: MatchResult): Promise<void>    // ganada, abandonada…
}
```

- `HandRecord` contiene los **eventos completos** del motor (sin filtrar), cada uno con
  `at` (ms del servidor) y `actor` (`{ seat, by: 'human' | 'bot' | 'timeout' } | 'system'`), más el
  marcador al empezar y al acabar la mano. Así se cubre la deuda de H1 (eventos sin marca de tiempo
  ni actor). Este log contiene cartas: **es solo de servidor** y nunca se envía ni se escribe en los
  logs de pino.
- **H3**: adaptador en memoria (tests) y adaptador de ficheros JSON Lines para desarrollo
  (`.data/match-logs/`, ignorado por git).
- **H6**: adaptador Prisma en un **paquete de BD compartido** (`packages/db`: cliente de Prisma,
  esquema y repositorios) que usan `api` y `game`. `game` escribe directamente en PostgreSQL, sin
  pasar por la API. **Cambia las reglas de dependencias de CLAUDE.md §4** (aprobado por Antonio):
  `game` → `engine`, `bots`, `shared`, `db`; `api` → `shared`, `db`; `db` → `shared` (solo tipos).
  La regla de dependency-cruiser se añade cuando exista el paquete (H6).
- Si una escritura falla, se registra el error en pino y la partida sigue: un fallo del log no puede
  dejar una mesa colgada. Garantizar la entrega (cola de salida o reintentos) se decide con Prisma en H6.

### 5. Flujo de la mesa

- **Lobby y asientos.** Se entra como `player` o `spectator`. El jugador elige un asiento libre; en
  `duo_vs_bots` los dos humanos van en la misma pareja (0/2 o 1/3). La partida empieza cuando están
  todos los humanos que pide el modo (§7); en `solo`, al entrar (el creador se sienta en el 0). Antes
  de empezar se puede cambiar de asiento. Los personajes rivales (y el compañero en `solo`) se eligen
  **al crear la sala**, porque en `solo` no hay lobby; los que no se eligen se sortean del catálogo,
  sin repetir personaje en la mesa.
- **Acciones.** El cliente envía `{ actionId, version, action }`. El servidor rechaza: asiento que no
  está en `pendingSeats`, acción que no está en `getLegalActions` (se compara con `sameAction`),
  `version` distinta de la actual (acción pensada sobre un estado viejo) y `actionId` repetido. Un
  `actionId` repetido **no** se vuelve a aplicar: se reenvía el mismo `actionResult` (idempotencia,
  §11). Se guardan los últimos `actionId` de cada asiento.
- **Turno de 30 s.** Al quedar un asiento pendiente se arma su `deadline`. Si vence, se aplica
  `getTimeoutAction` con `actor.by = 'timeout'`. En el descarte (simultáneo) hay un deadline por asiento.
- **Bots.** Al tocarle a un bot, se programa `decideAction` tras un retardo al azar entre
  `BOT_DELAY_MIN_MS` y `BOT_DELAY_MAX_MS`.
- **Entre manos (D19).** Tras `handOver` se envían las cartas reveladas y la siguiente mano empieza
  sola a los `HAND_PAUSE_MS` (8 s) con `startNextHand`. Sin botón «listo».
- **Abandono y reconexión (D7).** Al caer la conexión (`onDrop`) o al salir, el asiento pasa en el
  acto a un bot con el personaje neutro; si era su turno, el bot juega. El asiento queda reservado al
  `userId` hasta el fin de la partida (`allowReconnection(client, 'manual')` para la misma sesión y
  reentrada por `userId` para una nueva). Al volver, recupera el asiento cuando termina la acción en
  curso y recibe su `game:view` completo.
- **Sala sin humanos conectados (D20).** La partida se **pausa** (`status: 'paused'`, sin turnos ni
  bots). Si vuelve un humano, se reanuda con un deadline nuevo. Si en `EMPTY_ROOM_TIMEOUT_MS`
  (10 min) no vuelve nadie, la sala se cierra y la partida se guarda como abandonada. Con al menos un
  humano conectado, los bots juegan por los ausentes.
- **Fin de partida.** `matchWon` → `finishMatch`, `status: 'finished'`, se mantiene la sala un rato
  para ver el resultado y se cierra.

### 6. Salas privadas, espectadores, chat y reacciones

- **Código privado (D21).** 6 caracteres de `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (sin 0/O/1/I/L), generado
  con `crypto.randomInt`. Se comprueba en `onAuth` con `crypto.timingSafeEqual` sobre los bytes. Rate-limit
  de **5 intentos fallidos por minuto** por IP y sala; superado, se rechaza sin comparar.
- **Espectadores.** Máximo `MAX_SPECTATORS` (5); el sexto recibe un error claro. Reciben
  `getView(state, 'spectator')` y los eventos filtrados para `'spectator'` (D17).
- **Chat.** Un canal para todos: ≤ 200 caracteres, sin caracteres de control, recortado, con rol
  (`player` | `spectator`) y apodo del servidor (nunca el del cliente). **5 mensajes cada 10 s** por
  cliente. El cliente lo pinta como texto, nunca como HTML.
- **Reacciones.** Lista cerrada en `shared`: 👏 😂 😮 😡 🔥 👍 👎 🤔. **3 cada 5 s** por cliente.
- **Límites globales.** `maxMessagesPerSecond` de Colyseus como red de seguridad (desconecta a quien
  inunde la sala); `maxClients` con margen sobre jugadores + espectadores, para que quien sobra reciba
  el error claro de la admisión (`PLAYERS_FULL`, `SPECTATORS_FULL`) y quien vuelve desde otra conexión
  pueda entrar antes de que se cierre la antigua (que se sustituye).
- Rate-limits **en memoria** (un solo proceso). Pasan a Redis cuando haya más de un proceso (H7/H10).

### 7. Contratos en `shared` y constantes

- `shared` define con Zod los mensajes cliente → servidor (`game:action`, `seat:take`, `seat:leave`,
  `chat:send`, `reaction:send`), las opciones de creación (con los personajes) y de unión de sala, y los tipos
  de los mensajes servidor → cliente. Las acciones se validan con un esquema Zod de `Action` en `shared`
  y, después, contra `getLegalActions`.
- Constantes nuevas en `shared/constants.ts`: `HAND_PAUSE_MS = 8_000`, `EMPTY_ROOM_TIMEOUT_MS =
  600_000`, `CHAT_MAX_LENGTH = 200`, `CHAT_RATE = { max: 5, windowMs: 10_000 }`,
  `REACTION_RATE = { max: 3, windowMs: 5_000 }`, `PRIVATE_CODE_LENGTH = 6`,
  `PRIVATE_CODE_ALPHABET`, `PRIVATE_CODE_MAX_FAILS = { max: 5, windowMs: 60_000 }`, `REACTIONS`.

### 8. Tests

| Capa | Herramienta | Qué cubre |
|---|---|---|
| Unidad | Vitest + reloj falso | `MatchController`: idempotencia, versión, fuera de turno, acción ilegal, timeout en cada fase (también descarte simultáneo), retardo de bots, pausa entre manos, pausa y cierre por sala vacía, sustitución y regreso del humano, fin de partida y log. `seating`, `private-code`, rate-limits, sanitizado del chat, `Rng` de producción |
| Contratos | Vitest | Esquemas Zod de `shared`: válidos e inválidos (tipos, longitudes, emojis fuera de lista, campos extra) |
| Integración | `@colyseus/testing` + `@colyseus/sdk` | Flujos de §7 con clientes reales: asientos e inicio por modo, timeout, reconexión (misma sesión y nueva por `userId`), espectadores y el sexto rechazado, sala privada (código bueno, malo y rate-limit), chat y reacciones con límite, identidad dev rechazada sin datos válidos |
| Fuga de información | Integración + propiedades | Se graba **todo** lo que recibe cada cliente (jugadores y espectadores) durante partidas completas con semillas distintas y se comprueba que ninguna carta ajena aparece antes de `handRevealed`. Las cartas se buscan en el JSON serializado, no en campos concretos. Se repite con desconexiones y reconexiones a mitad de mano |
| Partida completa | Integración | Script con 4 clientes de bot aleatorio que juegan hasta `matchWon`; el log guardado tiene todas las manos y es coherente con el marcador final |
| Arranque | Integración | `/health` responde; con `NODE_ENV=production` y el verificador de desarrollo, el servidor no arranca |

- Los tests de integración usan tiempos cortos (turno y retardos inyectados por configuración), nunca
  `sleep` de 30 s.
- Cobertura de `apps/game` ≥ 90 % de líneas y ramas, comprobada en CI (sin contar `cli/` ni `main.ts`).

### 9. Cliente de consola

`pnpm --filter @31mus/game play` abre un cliente de texto (`@colyseus/sdk`) que crea o se une a una
sala, se sienta y juega eligiendo las acciones legales por número. `pnpm --filter @31mus/game
play:script` juega una partida `solo` completa con un bot aleatorio en el asiento humano y termina con
el marcador. Ambos usan la identidad de desarrollo.

### 10. Dependencias

- `@colyseus/core`, `@colyseus/ws-transport` y `@colyseus/schema` (0.18 / 5.0), **no** el meta-paquete
  `colyseus`, que arrastra monitor, playground, auth y Redis, que no se usan.
- `pino` para logs estructurados con `roomId`, `handId` y `userId` (deuda de H0).
- Desarrollo: `@colyseus/testing` (y su par `@colyseus/tools`) y `@colyseus/sdk`.
- Sin Redis en H3: un único proceso.

## Alternativas consideradas

### A · Estado público en el `Schema` y partida en mensajes (elegida)

| Dimensión | Valoración |
|---|---|
| Complejidad | Media: dos canales (estado y mensajes) |
| Seguridad | Alta: lo privado solo sale por `getView`/`getEventView`, en un único módulo |
| Testeabilidad | Alta: lo que recibe cada cliente es JSON simple |
| Ancho de banda | Algo más: se reenvía la vista completa tras cada paso (cientos de bytes) |

**A favor:** reutiliza el filtrado del motor, ya probado con propiedades; el test de fuga es directo.
**En contra:** no aprovecha los parches incrementales de Colyseus para la partida; irrelevante a 4
jugadores por mesa.

### B · Toda la partida en el `Schema` con filtros por cliente (`StateView`)

**A favor:** un solo canal y parches incrementales.
**En contra:** duplica en el `Schema` el modelo del motor, mezcla público y privado en una estructura,
y la seguridad depende de anotar bien cada campo. El test de fuga tendría que decodificar el protocolo
de Colyseus. Descartada.

### C · Log de manos enviado a la API por HTTP interno

**A favor:** respeta las reglas de §4 tal como están; una sola app escribe en la BD.
**En contra:** otro salto de red, otra autenticación entre servicios y la API caída haría perder
manos. Descartada por Antonio a favor del paquete de BD compartido (§4).

### Otras decisiones con alternativa

- **Lógica dentro de `MusRoom`**: menos archivos, pero obliga a probar el tiempo con relojes reales
  de Colyseus. Descartado a favor de `MatchController` (§2).
- **Botón «listo» entre manos**: más control para el jugador, pero bloquea la mesa si uno no pulsa.
  Descartado (D19).
- **Cerrar la sala al irse el último humano**: más simple, pero castiga un corte de red de todos.
  Descartado (D20).
- **Redis ya en H3**: no aporta nada con un proceso; llega con la clasificatoria (H7).

## Análisis de compromisos

La prioridad de H3 es que **no se filtre nada** y que la mesa **nunca se quede colgada**. Mandar la
partida en mensajes construidos solo con el filtrado del motor cuesta algo de ancho de banda, pero
convierte la seguridad en una propiedad fácil de comprobar. Sacar la lógica de Colyseus añade una
capa, pero hace testeable cada temporizador con un reloj falso. El paquete de BD compartido rompe la
simetría de §4 a cambio de que el log no dependa de que la API esté viva.

## Consecuencias

- **Más fácil:** el cliente web (H4) consume mensajes JSON tipados desde `shared`; cambiar la identidad
  en H6 y la persistencia a Prisma no toca la sala; la clasificatoria (H7) reutiliza `MusRoom` con
  `mode: 'ranked'`.
- **Más difícil:** mantener sincronizados el `Schema` público y los mensajes; cada nuevo mensaje debe
  pasar por `outbound.ts` y por el test de fuga.
- **A revisar:** en H6, la garantía de entrega del log y el adaptador Prisma; en H7/H10, rate-limits y
  presencia en Redis si hay más de un proceso; en H9, qué pasa si se cae el proceso a mitad de partida
  (hoy se pierde la partida en curso; el log de las manos terminadas queda guardado).

## Tareas

1. [x] Antonio acepta este ADR y las decisiones D18–D21 (24/11/2026).
2. [x] `shared`: esquemas Zod de mensajes y acciones, reacciones y constantes.
3. [x] `MusRoom`, `server.ts` y lobby: asientos, modos, personajes, sala privada con código.
4. [x] `MatchController`: acciones con idempotencia, turno de 30 s, bots, pausa entre manos, fin.
5. [ ] Abandono y reconexión (D7, D20), espectadores (D17), chat y reacciones con límite.
6. [ ] `MatchLogStore` en memoria y en ficheros.
7. [ ] Cliente de consola y script de partida completa.
8. [ ] Tests de §8, fuga de información y cobertura ≥ 90 %.
9. [ ] Al cerrar H3: `/code-review`, HITOS, `docs/ARQUITECTURA.md` §9 y CLAUDE.md §4/§7.
