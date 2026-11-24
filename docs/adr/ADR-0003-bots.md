# ADR-0003 · Diseño de los bots (`packages/bots`)

- **Estado:** aceptado (Antonio, 24/11/2026)
- **Fecha:** 24/11/2026
- **Hito:** H2 · Bots
- **Decide:** Antonio

## Contexto

Los bots juegan en los modos `solo` y `duo_vs_bots`, sustituyen a quien se desconecta (D7) y sirven
de rival en los tests del servidor (H3). H2 pide un bot de dificultad **media** que haga faroles, un bot
aleatorio de referencia y cinco **personajes** con el mismo nivel y distinto estilo (D9, HITOS H2).

Restricciones que ya están fijadas:

- `bots` solo depende de `engine` (CLAUDE.md §4) y usa el perfil ESLint `pure`: sin I/O, sin tiempo ni
  azar implícitos. El azar entra por el `Rng` del motor (ADR-0002 §2).
- El retardo «humano» de 1 a 3 s lo aplica el servidor, no el bot.
- No hay señas (REGLAS_MUS.md §1).
- **DoD**: 10.000 partidas bot contra bot sin errores; el bot medio gana ≥ 70 % al aleatorio; frecuencia
  de faroles medida y documentada; estilos medibles distintos y ningún personaje gana a otro más del
  60 % en 5.000 partidas.

Quedan por decidir: qué información recibe el bot, cómo mide la fuerza de su mano, cómo decide, cómo se
expresan los personajes y dónde y cuándo se ejecutan las simulaciones largas.

## Decisión

### 1. El bot ve lo mismo que un humano en su asiento

El bot recibe **solo** la `PlayerView` de su asiento (`getView(state, seat)`) y la lista de acciones
legales que le da el servidor. Nunca recibe `MatchState`, así que **no puede hacer trampas** aunque una
pareja mixta (humano + bot) juegue contra humanos. Es una garantía de tipos, no de disciplina.

```ts
interface BotInput {
  readonly view: PlayerView;
  readonly legal: readonly Action[];
  readonly persona: BotPersona;
  readonly rng: Rng;
}

interface BotDecision {
  readonly action: Action;
  /** `true` si es un envite, una subida o un órdago con mano floja: sirve para medir los faroles. */
  readonly bluff: boolean;
}

decideAction(input: BotInput): BotDecision   // bot medio, con el estilo del personaje
randomAction(legal: readonly Action[], rng: Rng): Action   // bot aleatorio de referencia
BOT_PERSONAS: readonly BotPersona[]          // catálogo
```

- Función **pura**: misma vista, mismas acciones legales, mismo personaje y misma semilla → misma acción.
- La acción devuelta es **siempre** una de `legal` (se elige de la lista, nunca se construye aparte).

### 2. Fuerza de la mano: tablas exactas por combinación de figuras

En el mus el palo no cuenta para ningún lance: una mano queda definida por sus cuatro figuras de mus
(A, 4, 5, 6, 7, S, C, R, con los treses como reyes y los doses como ases). Solo hay **330
combinaciones** posibles, cada una con su número de manos reales (de las 91.390).

- Al cargar el paquete se calcula, para cada lance y cada combinación, su **percentil**: qué fracción de
  las 91.390 manos posibles le gana, empata o pierde. Son 330 × 330 comparaciones por lance (~0,5 M en
  total, unos milisegundos), con los evaluadores del motor. Sin tablas escritas a mano ni ficheros
  generados que mantener.
- En una decisión, la fuerza de un lance es una consulta O(1). Se ajusta por:
  - **Posición**: la mano gana los empates; el postre, los pierde.
  - **Lo declarado**: en pares y juego, si un rival declara jugada, la fuerza se mide solo contra las
    manos con jugada.
  - **Rivales**: hay que ganar a dos manos, así que la probabilidad aproximada es `p²`.
- **Compañero**: su mano se estima con la distribución general y se corrige con lo que ha hecho
  (si envidó o subió, se le supone fuerte en ese lance; si pasó, flojo).

### 3. Decisiones del bot medio

| Momento | Regla |
|---|---|
| Mus | Corta si el valor de la mano (suma ponderada de la fuerza en los cuatro lances) supera el umbral del personaje |
| Descarte | Prueba los 15 descartes posibles y elige el de mayor valor esperado, promediando sobre las figuras que podría robar (como mucho 330 casos por opción) |
| Hablar sin apuesta | Envida si la fuerza de la pareja supera su umbral; la cantidad crece con la fuerza; órdago solo con fuerza muy alta y la propensión del personaje |
| Responder | Quiere si la fuerza compensa el tamaño de la apuesta (más tantos en juego → más fuerza exigida); sube con fuerza alta; si no, no quiere |
| Farol | Con mano floja, envida o sube con la probabilidad de farol del personaje |
| Marcador | Cerca de 40 (de cualquiera de las dos parejas) los umbrales bajan y el órdago se vuelve más probable |

Las constantes de ajuste (pesos, umbrales base, curva del marcador) viven en `bots/src/tuning.ts`,
nombradas y comentadas, sin números mágicos.

### 4. Personajes: el mismo bot con otros parámetros

```ts
interface BotPersona {
  readonly id: string;          // 'abuelo', 'faraona', 'pollo', 'rosario', 'neutro'
  readonly name: string;        // «El Abuelo»…
  readonly description: string; // una línea, en español
  readonly style: BotStyle;
}

interface BotStyle {
  readonly cutTendency: number;    // tendencia a cortar el mus
  readonly aggression: number;     // ganas de envidar y subir
  readonly bluffRate: number;      // probabilidad de farol con mano floja
  readonly ordagoPropensity: number;
  readonly caution: number;        // fuerza que exige para querer
}
```

Todos los parámetros están en [0, 1] y modulan los umbrales de §3: el nivel es el mismo y solo cambia
el estilo. El catálogo es el de HITOS H2 (El Abuelo, La Faraona, El Pollo, Doña Rosario y Neutro, que
sustituye a quien se desconecta). El avatar es un marcador hasta la Fase 2.

### 5. Bot aleatorio

Elige una acción legal con probabilidad uniforme. Se exporta (no vive en `src/testing/`) porque también
lo usarán los tests de `apps/game`.

### 6. Simulaciones en dos niveles

- **`pnpm test`** (cada commit y CI), en menos de ~30 s: 1.000 partidas de bots medios y personajes
  variados sin errores, y 2.000 partidas de bots medios contra aleatorios con victoria ≥ 70 %.
- **`pnpm --filter @31mus/bots sim`**, aparte: la DoD completa. 10.000 partidas, la matriz de personajes
  (10 enfrentamientos × 5.000 partidas) y la medición de faroles y estilos. Es otro fichero de
  configuración de Vitest (`vitest.sim.config.js`, ficheros `*.sim.ts`), sin dependencias nuevas ni
  variables de entorno. Escribe los resultados en `docs/bots/MEDICIONES.md`. Se ejecuta antes de
  cerrar el hito y cuando cambie `tuning.ts`.
- En las partidas entre dos estilos, las parejas cambian de asiento en la mitad de las partidas para
  anular la ventaja de ser mano.
- CLAUDE.md §9 pasa a decir que las 10.000 partidas se ejecutan con `sim` (aprobado por Antonio con el
  plan de H2, 24/11/2026).

### 7. Tests

| Qué | Tipo |
|---|---|
| Tablas: 31 es el mejor juego; duples de reyes, los mejores pares; las 330 combinaciones suman 91.390 manos | Unitarios |
| Decisiones: con duples no descarta los pares; con 31 corta; con mano floja no quiere un envite de 10; cerca de 40 envida más | Unitarios por escenario |
| La acción está siempre en `legal`; misma entrada y semilla → misma acción | Propiedades (fast-check) |
| Cambiar las cartas ocultas de los rivales no cambia la decisión (se comprueba construyendo dos estados con la misma vista) | Propiedades |
| Cada personaje es medible: el agresivo envida y ordaga más que el conservador | Simulación |
| DoD completa | `sim` |

Cobertura mínima del 95 % en `bots`, como en el motor.

## Alternativas consideradas

### A · Tablas de percentiles por combinación de figuras (elegida)

| Dimensión | Valoración |
|---|---|
| Complejidad | Media |
| Coste por decisión | O(1) para la fuerza; ~5.000 evaluaciones baratas para el descarte |
| Calidad de juego | Buena: la fuerza es exacta frente a la distribución de manos |
| Ajuste | Sencillo: pocos parámetros con significado |

**A favor:** exacta, rápida, determinista y fácil de explicar y de medir. Permite 50.000 partidas en
pocos minutos.
**En contra:** no condiciona por las cartas propias (las 4 que tengo no pueden estar en otra mano); el
error es pequeño y se puede corregir más adelante.

### B · Monte Carlo en cada decisión

Repartir al azar las cartas que no veo cientos de veces y jugar los lances.
**A favor:** condiciona por todo lo que se ve.
**En contra:** cientos de evaluaciones por decisión, ruido dependiente del `Rng` y simulaciones de la DoD
de horas. Descartada.

### C · Reglas escritas a mano por lance

«Con duples, envida 5», «con 31, quiere siempre»…
**A favor:** rápida y legible.
**En contra:** frágil, con muchos casos límite y difícil de equilibrar entre personajes sin una medida de
fuerza común. Descartada como base; se usa como prueba de cordura en los tests.

### D · Política aprendida (CFR o aprendizaje por refuerzo)

**A favor:** juego potencialmente muy fuerte.
**En contra:** fuera del alcance de un bot «medio», opaca, cara de entrenar y de auditar. Descartada.

### Otras decisiones con alternativa

- **Dar al bot el `MatchState`**: más simple de cablear, pero permitiría trampas y rompería la
  confianza en las partidas con humanos. Descartado.
- **Las 10.000 partidas en `pnpm test`**: cumple la letra de CLAUDE.md §9, pero añade minutos a cada
  commit. Descartado a favor de los dos niveles de §6.

## Análisis de compromisos

El bot medio no necesita jugar perfecto: necesita jugar **creíble y equilibrado**, ser **rápido**
(miles de partidas en tests) y **reproducible**. Las tablas exactas por figura dan una medida de fuerza
común a los cinco lances y a los cinco personajes, sobre la que los parámetros de estilo son fáciles de
razonar y de medir. El coste es una aproximación (no condiciona por las cartas propias ni modela al
rival en profundidad) que se puede afinar sin cambiar la API.

## Consecuencias

- **Más fácil:** añadir personajes (solo datos), medir estilos y reproducir cualquier partida con su
  semilla; el servidor solo llama a `decideAction` con la vista y las acciones legales.
- **Más difícil:** equilibrar los personajes (≤ 60 %) puede pedir varias iteraciones de `tuning.ts`.
- **A revisar:** si el bot medio resulta flojo contra humanos, condicionar la fuerza por las cartas
  propias y por los descartes de los rivales, sin cambiar la API.

## Tareas

1. [x] Antonio acepta este ADR (24/11/2026).
2. [x] Actualizar CLAUDE.md §9 (simulaciones en dos niveles) y añadir `BOT_DELAY_MIN_MS` y
       `BOT_DELAY_MAX_MS` a `shared`.
3. [x] Tablas de fuerza con sus tests.
4. [x] Bot aleatorio y arnés de simulación.
5. [x] Bot medio: mus, descarte, envites, respuestas, faroles y marcador.
6. [x] Catálogo de personajes.
7. [x] Configuración `sim`, ejecución de la DoD y `docs/bots/MEDICIONES.md`.
8. [x] Al cerrar H2: reflejar la API en `docs/ARQUITECTURA.md`.
