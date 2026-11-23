# Reglas del mus — especificación de 31mus

> Fuente de verdad para `packages/engine`. Cada regla debe tener al menos un test.
> Todas las decisiones están confirmadas por Antonio (D1–D4, 19/11/2026). Si aparece una ambigüedad nueva, parar y preguntar.

## 1. Configuración

| Parámetro | Valor |
|---|---|
| Variante | **8 reyes** |
| Baraja | Española de 40 cartas: 1, 2, 3, 4, 5, 6, 7, sota (10), caballo (11), rey (12) en oros, copas, espadas y bastos |
| Jugadores | 4, en 2 parejas: asientos 0+2 vs 1+3 |
| Tantos por juego | **40** |
| Partida | **Al mejor de 3 juegos** (gana quien gane 2) |
| Turno | 30 s por decisión |
| Señas | No hay |
| Mus | Ilimitado |

### 1.1 Equivalencias a 8 reyes
- Los **treses son reyes** y los **doses son ases** a todos los efectos (grande, chica, pares y valor en juego).
- Rango para grande, chica y pares (de mayor a menor):
  `R (12 y 3) > C (11) > S (10) > 7 > 6 > 5 > 4 > A (1 y 2)`.

### 1.2 Valor de las cartas para juego y punto
- Rey (12 y 3), caballo y sota: **10**.
- 7, 6, 5 y 4: su número.
- As (1 y 2): **1**.

## 2. Mano, postre y orden
- El orden de juego es **antihorario** (hacia la derecha): `siguiente = (seat + 1) % 4`.
- **Mano**: el jugador que habla primero en cada fase. **Postre**: el último (el que reparte).
- Al terminar cada mano, la mano pasa al siguiente jugador.
- El primer mano de la partida se sortea. La rotación continúa entre juegos.
- **Empates** en cualquier lance: gana el jugador **más cercano a la mano**, en orden de juego.

## 3. Reparto y mus
1. Se baraja (Fisher–Yates con RNG criptográfico) y se reparten 4 cartas a cada jugador.
2. **Fase de mus**: empezando por la mano, cada jugador dice **"mus"** o **"no hay mus"**.
   - Si alguien dice "no hay mus", la fase se corta y se juegan los lances con las cartas actuales.
   - Si los cuatro dicen "mus", hay **descarte**: cada jugador descarta **de 1 a 4 cartas**.
     Los descartes se eligen en paralelo con un único plazo de 30 s y se revelan a la vez.
   - Después se reponen las cartas por orden desde la mano y se vuelve a la fase de mus.
3. El mus es **ilimitado**. Si el mazo no tiene cartas suficientes para reponer, se barajan **todos los
   descartes acumulados** (no las manos) y forman el nuevo mazo.
4. **Sin mus corrido**: desde la primera mano se juega con mus normal.

## 4. Lances
Orden fijo: **Grande → Chica → Pares → Juego** (o **Punto** si nadie tiene juego).

### 4.1 Grande
Gana la mano con las cartas más altas. Se ordenan las 4 cartas de mayor a menor y se comparan
posición a posición. Si son iguales, decide el criterio de empate.

### 4.2 Chica
Igual que la grande pero a la inversa: se ordenan de menor a mayor y gana la más baja.

### 4.3 Pares
**Declaración**: empezando por la mano, cada jugador declara automáticamente si tiene pares o no
(en digital es automático y visible para todos).

| Jugada | Definición | Valor |
|---|---|---|
| Pareja | 2 cartas del mismo rango | 1 |
| Medias | 3 cartas del mismo rango | 2 |
| Duples | 2 parejas, o 4 cartas del mismo rango | 3 |

- Comparación: **duples > medias > pareja**. A igual tipo, gana el rango más alto.
  Duples: se compara primero la pareja alta y luego la baja; 4 reyes son los duples más altos.
- Si **ninguna pareja** tiene pares, el lance no se juega.
- Si **solo una pareja** tiene pares, no hay envite y esa pareja cobra el valor de sus pares en el recuento.
- Si **las dos** tienen pares, hay ronda de envites. **Solo hablan los jugadores que tienen pares.**
- La pareja ganadora cobra, en el recuento, **la suma de los pares de sus dos jugadores** (de quien los tenga),
  más el envite si se quiso.

### 4.4 Juego
**Declaración**: igual que en pares. Hay juego si las cartas suman **31 o más**.

- Orden de juego (de mejor a peor): **31 > 32 > 40 > 37 > 36 > 35 > 34 > 33**.
- **Todas las 31 valen lo mismo**: no existe la 31 real.
- Valor en el recuento: **31 = 3 tantos**; cualquier otro juego = **2 tantos**.
- Si solo una pareja tiene juego, no hay envite y cobra sus valores en el recuento.
- Si las dos tienen juego, hay envites y **solo hablan los jugadores con juego**.
- La pareja ganadora cobra la suma de los valores de juego de sus jugadores, más el envite.

### 4.5 Punto
Solo si **nadie** tiene juego. Gana la suma más alta (máximo 30). Vale **1 tanto**, más el envite.
Hablan todos los jugadores.

## 5. Envites
En cada lance con envites, el turno de palabra empieza por la mano y sigue el orden de juego.

Acciones del jugador que tiene la palabra, si no hay apuesta abierta:
- **Paso**.
- **Envido**: 2 tantos.
- **Envido N**: cantidad libre, con N ≥ 2.
- **Órdago**: se juega el juego entero.

Respuestas posibles ante una apuesta de la pareja rival:
- **Quiero**: la apuesta queda aceptada y se cobra en el recuento.
- **No quiero**.
- **Reenvido N más**: sube la apuesta en N (mínimo 1 tanto) y la palabra pasa a la otra pareja.
- **Órdago**.

Detalles del flujo:
- Responde primero el siguiente rival en orden de juego. Si dice "no quiero", **su compañero también
  puede responder**. Si cualquiera de los dos quiere, queda aceptado. Si los dos dicen "no quiero", queda rechazado.
- Si todos pasan, el lance queda **en paso**:
  - Grande y chica en paso: el ganador cobra **1 tanto** en el recuento.
  - Pares, juego y punto en paso: el ganador cobra solo el valor de sus jugadas (en punto, 1 tanto).
- **Deje** (apuesta rechazada): la pareja que apostó cobra **en el momento**:
  - 1 tanto si se rechaza la primera apuesta del lance;
  - si se rechaza un reenvido, la cantidad que ya estaba aceptada antes de la última subida.
- En pares y juego, si hay "no quiero", la pareja que rechazó **renuncia al lance**. La pareja que
  apostó cobra el deje y, además, el valor de sus propias jugadas en el recuento.
- **Órdago aceptado**: se muestran las cartas, se resuelve ese lance y su ganador **gana el juego**
  (llega a 40 de golpe). El resto de la mano no se juega.
- **Órdago rechazado**: se trata como cualquier "no quiero", con su deje.

## 6. Recuento
Al terminar los lances se enseñan las cartas necesarias y se cuenta en este orden estricto:
**grande → chica → pares → juego/punto**.

- En cada lance se suma: lo envidado y aceptado (o el tanto en paso) más el valor de las jugadas, cuando corresponde.
- Los dejes ya se cobraron durante la mano.
- **En cuanto una pareja llega a 40 tantos**, durante la mano o en el recuento, **gana el juego al instante**.
  Lo que quede por contar no se cuenta, aunque la otra pareja también hubiera llegado a 40.
- Al ganar un juego, los tantos vuelven a 0 y empieza el siguiente. Quien gana 2 juegos gana la partida.

## 7. Amarracos (solo presentación)
- 1 amarraco = 5 tantos. El marcador muestra amarracos y piedras sueltas (tantos de 1 a 4) por pareja.
- Además se muestra el marcador numérico, por accesibilidad.

## 8. Temporizador (acción por defecto al agotar 30 s)
Lo expone el motor con `getTimeoutAction(state, seat)`:

| Situación | Acción por defecto |
|---|---|
| Decisión de mus | **"No hay mus"** |
| Descarte | Descartar **1 carta**, la peor según la heurística del bot |
| Hablar en un lance sin apuesta | **Paso** |
| Responder a una apuesta | **No quiero** |

## 9. Información visible
- **Jugador**: sus cartas, el número de cartas de los demás, declaraciones, envites, marcador y su
  propio descarte (de los demás, solo cuántas cartas descartaron).
- **Espectador**: lo mismo que un jugador **pero sin ninguna carta**.
- **Fin de mano**: se revelan las cartas de los jugadores que intervienen en el recuento.
- **Órdago aceptado**: se revelan las cartas de todos.
