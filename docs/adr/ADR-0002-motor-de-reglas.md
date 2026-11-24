# ADR-0002 · Diseño del motor de reglas (`packages/engine`)

- **Estado:** aceptado (Antonio, 24/11/2026)
- **Fecha:** 24/11/2026
- **Hito:** H1 · Motor de reglas
- **Decide:** Antonio

## Contexto

El motor es la **única autoridad** sobre las reglas (CLAUDE.md §2): el servidor de juego (H3) valida con
él cada intención del cliente, los bots (H2) eligen entre sus acciones legales y la web (H5) solo lo usa
para presentación. La especificación completa está en `docs/REGLAS_MUS.md` (D1–D4 y D10–D16).

Restricciones que ya están fijadas:

- **Puro y determinista**: sin I/O, sin tiempo ni azar implícitos (perfil ESLint `pure`, ADR-0001 §5).
  `engine` no depende de ningún otro paquete (dependency-cruiser).
- **Inmutable**: funciones que devuelven estado nuevo; nada de clases con estado (CLAUDE.md §5).
- **API mínima** de CLAUDE.md §6: `createMatch`, `getLegalActions`, `applyAction`, `getView`,
  `getTimeoutAction`. El temporizador vive en el servidor.
- **Información oculta**: ninguna vista ni evento puede revelar cartas ajenas antes del fin de mano (D16).
- **Calidad**: cobertura ≥ 95 %, tests de propiedades (fast-check) y 1.000 partidas aleatorias sin errores.

Quedan por decidir: cómo se modela el estado, cómo entra el azar, cómo se expresan las acciones legales,
cómo se filtran los eventos, cómo encajan los descartes en paralelo y el fin de mano, y dónde viven las
constantes de reglas.

## Decisión

### 1. Estado: datos JSON inmutables y una función reductora

- `MatchState` es **datos planos serializables a JSON**: objetos, arrays, cadenas, números y booleanos.
  Sin `Map`, `Set`, funciones, `undefined` significativo ni referencias cíclicas. Así se puede guardar,
  enviar, comparar y reproducir sin adaptadores.
- Tipos con `readonly` en todos los niveles. En tests se congela el estado de entrada (`deepFreeze`) para
  comprobar que `applyAction` no lo muta; en producción no se congela (coste innecesario).
- Las fases son **uniones discriminadas** por `phase`. Cada transición es una función pura
  `(state, …) → Result<{ state, events }, MusError>` y el `switch` es exhaustivo
  (`switch-exhaustiveness-check` ya está activo).
- Sin dependencias de ejecución: ni Immer ni librerías de máquinas de estados.

### 2. Azar: `Rng` inyectado, nunca dentro del estado

```ts
interface Rng {
  /** Entero uniforme en [0, bound). */
  nextInt(bound: number): number;
}
```

- El motor baraja con **Fisher–Yates** sobre el `Rng` que recibe. Lo usan `createMatch` (sorteo de la
  primera mano y primer reparto), `startNextHand` y el rebarajado de descartes dentro de `applyAction`.
- El motor exporta `createSeededRng(seed)` (xoshiro128\*\* sembrado con splitmix32, muestreo por rechazo
  para evitar sesgo de módulo) para **tests, bots y simulaciones**. Es el único objeto con estado del
  paquete y vive fuera de `MatchState`.
- En producción (H3), `apps/game` inyecta un `Rng` criptográfico basado en `node:crypto.randomInt`.
  Así se cumple el «RNG criptográfico» de REGLAS_MUS.md §3 sin meter módulos de Node en el motor.
- La **semilla nunca forma parte del estado**: si el estado se filtrara, no revelaría el mazo. Las
  partidas de producción se reproducen desde el log de eventos (que incluye las cartas repartidas),
  no desde la semilla.

### 3. API pública

```ts
createMatch(config: MatchConfig, rng: Rng): MatchState
getLegalActions(state: MatchState, seat: Seat): readonly Action[]
applyAction(state, seat, action, ctx: { rng: Rng }): Result<{ state: MatchState; events: readonly GameEvent[] }, MusError>
startNextHand(state: MatchState, ctx: { rng: Rng }): Result<{ state: MatchState; events: readonly GameEvent[] }, MusError>
getView(state: MatchState, viewer: Seat | 'spectator'): PlayerView
getEventView(event: GameEvent, viewer: Seat | 'spectator'): GameEvent | null
getTimeoutAction(state: MatchState, seat: Seat): Action | null
```

Sobre CLAUDE.md §6 se añaden dos funciones:

- **`startNextHand`**: al acabar una mano el estado queda en `handOver` (o `gameOver`) con las cuatro
  manos reveladas (D16). El servidor decide cuánto tiempo se muestran y después llama a `startNextHand`.
  Sin esta pausa explícita, el motor repartiría la mano siguiente en la misma llamada y `getView` no
  podría enseñar las cartas del final.
- **`getEventView`**: los eventos se generan con toda la información (es lo que se persiste en
  `HandLog`, solo en servidor). Antes de enviarlos, el servidor los pasa por `getEventView`, que tapa
  las cartas que el espectador o jugador no debe ver o devuelve `null` si el evento no le corresponde.
  Es la misma frontera que `getView`, aplicada a los eventos.

`MatchConfig` empieza casi vacío (la variante está fija: 8 reyes, 40 tantos, al mejor de 3). Se deja
el tipo para no romper la firma cuando haga falta configurar algo.

### 4. Acciones legales enumeradas: una sola fuente de verdad

- `getLegalActions` devuelve **la lista completa y concreta** de acciones legales. Siempre es finita:
  como mucho 15 descartes posibles (subconjuntos no vacíos de 4 cartas) o unos 40 envites (D14 limita
  el total a 40).
- `applyAction` valida comprobando que la acción está en esa lista (igualdad estructural, con los
  descartes normalizados al orden de la mano). No hay un segundo validador que pueda contradecirla.
- Los bots eligen directamente de la lista y el test de propiedades «toda acción legal aplica sin
  error» se escribe de forma natural.
- Forma de las acciones (términos del mus en español, sin tildes):
  `mus`, `corto`, `discard { cards }`, `paso`, `envido { amount }`, `reenvido { amount }`, `quiero`,
  `noQuiero`, `ordago`. «Corto y envido» no es una acción: el servidor aplica `corto` y luego `envido`.
- La entrada externa (mensajes WebSocket) se valida con Zod en `shared` en H3; el motor recibe ya
  un `Action` tipado y aun así lo comprueba contra la lista legal.

### 5. Turnos: «quién puede actuar» en lugar de un único turno

- El estado expone los asientos que pueden actuar (`pendingSeats`). En casi todas las fases es uno;
  en el **descarte** son los cuatro a la vez (REGLAS_MUS.md §3): cada uno manda su descarte, el motor
  lo guarda sin revelarlo y, cuando están los cuatro, emite el evento con **cuántas** cartas descartó
  cada uno, repone desde la mano y vuelve a la fase de mus.
- La respuesta a envites (D12) es un subestado del lance: apuesta abierta, primer rival, compañero del
  primer rival (con la respuesta provisional del primero) y resolución por prioridad
  subida u órdago > quiero > no quiero.
- `getTimeoutAction` devuelve la acción por defecto de REGLAS_MUS.md §8 para cualquier asiento pendiente
  (`null` si no lo está). Para el compañero del primer rival devuelve la misma respuesta que dio su
  compañero (D12).

### 6. Representación de cartas y evaluadores

- Una carta es una cadena tipada con plantilla, `` `${Suit}-${Rank}` `` (p. ej. `'oros-12'`, `'copas-3'`):
  se compara con `===`, sirve de clave, se lee bien en logs y ocupa poco en JSON. La equivalencia
  de 8 reyes (3 → rey, 2 → as) se aplica en los evaluadores, no en la carta: la carta conserva su
  número real para que la interfaz pinte la que es.
- Cada evaluador (`grande`, `chica`, `pares`, `juego`, `punto`) es una función pura de 4 cartas a una
  **clave comparable**. Un único `resolveLance` compara las claves de los jugadores que participan y
  desempata por **cercanía a la mano** (REGLAS_MUS.md §2).

### 7. Errores tipados

`Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`. `MusError` es una unión de códigos
(`NOT_YOUR_TURN`, `ILLEGAL_ACTION`, `HAND_NOT_OVER`, `MATCH_OVER`…) con un mensaje en español para
logs. Los mensajes **nunca** incluyen cartas. El motor no lanza excepciones salvo por invariantes
rotos (bug), que los tests de propiedades deben hacer imposibles.

### 8. Constantes de reglas en el motor

`engine` no puede importar `shared`, y `shared` solo puede importar **tipos** de `engine`. Por eso las
constantes de reglas pasan a `packages/engine/src/rules.ts`: `POINTS_TO_WIN_GAME`,
`GAMES_TO_WIN_MATCH`, `MAX_BET` (40), `MIN_ENVIDO` (2), `MIN_REENVIDO` (1),
`RESHUFFLE_WARNING_THRESHOLD` (16) y `HAND_SIZE` (4). Se borran de `shared/src/constants.ts` (hoy
nadie las usa) y `game` y `web` las importan del motor. En `shared` se quedan las constantes de
producto: tiempos de turno, espectadores, puertos.

Esto **cambia el texto de CLAUDE.md §5**, que pone `POINTS_TO_WIN_GAME` en `shared`: hay que
actualizarlo si se acepta este ADR.

### 9. Estructura de módulos

```
packages/engine/src/
  index.ts            API pública (solo reexporta)
  rules.ts            constantes de reglas
  seat.ts             asientos, parejas, orden (ya existe)
  rng.ts              interfaz Rng, createSeededRng, shuffle
  result.ts errors.ts
  cards.ts deck.ts    cartas, baraja, reparto, rebarajado
  evaluators/         grande, chica, pares, juego, punto, resolve-lance
  phases/             deal, mus, discard, betting, scoring
  match.ts            createMatch, startNextHand, fin de juego y de partida
  apply-action.ts legal-actions.ts timeout.ts view.ts events.ts
```

Ningún archivo pasa de 300 líneas (CLAUDE.md §5).

### 10. Tests

- **Unitarios por regla**, con un helper de tests (no exportado) que construye estados concretos
  (manos, mano, marcador, fase) sin pasar por el reparto.
- **Tabla de casos** `docs/engine/CASOS_EVALUACION.md` (≥ 60 manos), fuente de verdad que el test lee y
  recorre. Leerla exige `node:fs` en un test del motor: hay que permitir los módulos de Node **solo en
  `*.test.ts`** del perfil `pure` (dependency-cruiser ya excluye los tests).
- **Propiedades** con fast-check (invariantes de CLAUDE.md §9, más: JSON de ida y vuelta conserva el
  estado, `applyAction` no muta su entrada, ninguna vista ni evento filtrado contiene cartas ajenas
  antes del fin de mano).
- **1.000 partidas completas** con jugadores aleatorios y semillas fijas.
- Versión de fast-check: **4.10.2**, la última con al menos 7 días el 24/11/2026 (la 4.10.3 es del 18/11).

## Alternativas consideradas

### A · Reductor puro con estado JSON y uniones discriminadas (elegida)

| Dimensión | Valoración |
|---|---|
| Complejidad | Media: hay que escribir las transiciones a mano |
| Dependencias | Ninguna |
| Testabilidad | Alta: entrada → salida, estados construibles a mano |
| Encaje con CLAUDE.md | Total (puro, inmutable, sin clases) |

**A favor:** serializable, fácil de filtrar, reproducible, sin dependencias, exhaustividad comprobada
por TypeScript. **En contra:** las actualizaciones anidadas con spreads son verbosas.

### B · Librería de máquinas de estados (XState)

| Dimensión | Valoración |
|---|---|
| Complejidad | Alta: modelo de actores, configuración propia |
| Dependencias | Una grande en un paquete que hoy no tiene ninguna |
| Testabilidad | Media: hay que extraer y restaurar instantáneas |
| Encaje con CLAUDE.md | Malo: actores con estado interno |

**A favor:** diagramas y visualización de estados. **En contra:** el estado no es un dato plano,
complica `getView` y la persistencia, y el subestado de envites (D12) no gana claridad.

### C · Clases con estado (`match.apply(action)`)

Descartada de entrada: CLAUDE.md §5 lo prohíbe y dificulta las instantáneas y los tests de propiedades.

### D · Immer para las actualizaciones

**A favor:** código de transición más corto. **En contra:** dependencia de ejecución en el motor y
congelado implícito. Se puede revisar si los spreads se vuelven difíciles de leer.

### Otras decisiones con alternativa

| Tema | Elegido | Descartado y por qué |
|---|---|---|
| Azar | `Rng` inyectado | Semilla en el estado: el estado revelaría el mazo y no admite RNG criptográfico |
| Validación | Lista legal enumerada | Validador aparte: dos fuentes de verdad que pueden divergir |
| Fin de mano | `handOver` + `startNextHand` | Avance automático: no deja mostrar las cartas reveladas (D16) |
| Eventos | Completos + `getEventView` | Eventos ya filtrados por destinatario: obliga a generar 5 versiones y el log no sería completo |
| Cartas | Cadena `'oros-12'` | Objeto `{ suit, rank }`: igualdad por campos, más ruido en JSON |

## Análisis de compromisos

Lo que más pesa es la **seguridad de la información oculta** y la **verificabilidad**. Un estado de
datos planos con dos funciones de filtrado (`getView`, `getEventView`) concentra en dos puntos
comprobables todo lo que sale hacia los clientes, y el test de propiedades puede recorrerlos en
miles de partidas. A cambio se escribe algo más de código de transición que con una librería, coste
asumible en un dominio cerrado de cinco lances.

Enumerar las acciones legales cuesta un poco más de cómputo (como mucho unas decenas de acciones por
decisión) y a cambio elimina la clase de bug «el bot o la UI ofrecen algo que el motor rechaza».

## Consecuencias

- **Más fácil:** reproducir partidas con semilla, depurar con instantáneas JSON, escribir bots
  (eligen de una lista), probar fugas de información y persistir el log completo.
- **Más difícil:** el servidor debe orquestar la pausa de fin de mano y filtrar cada evento antes de
  enviarlo; olvidar `getEventView` sería una fuga. El test de fuga de H3 debe cubrirlo.
- **A revisar:** Immer si las transiciones se vuelven ilegibles; `MatchConfig` si llegan variantes
  (4 reyes, 30 tantos); el formato de evento cuando se defina `HandLog` en H6.

## Tareas

1. [x] Actualizar CLAUDE.md §5 y §6 (constantes de reglas en el motor; `startNextHand` y `getEventView`).
2. [x] Permitir `node:fs`, `node:path` y `node:url` solo en tests y `src/testing/` de los perfiles puros. Los tipos de Node están en el `tsconfig.json` del motor; `tsconfig.build.json` los quita, así que el build falla si el código de producción los usa.
3. [x] Añadir fast-check 4.10.2 como devDependency del motor.
4. [x] Implementar los módulos de la §9 con sus tests (más `actions`, `step`, `state`, `invariant` y `testing/`).
5. [x] Redactar `docs/engine/CASOS_EVALUACION.md` (62 casos; revisado por Antonio el 24/11/2026).
6. [x] Al cerrar H1: reflejar la API en `docs/ARQUITECTURA.md`.
