# Casos de evaluación de lances

> Fuente de verdad que lee el test `packages/engine/src/evaluators/casos-evaluacion.test.ts`
> (ADR-0002 §10). Cada fila es una mano de 4 jugadores y el resultado que exige REGLAS_MUS.md.
> **Revisada por:** Antonio, 24/11/2026.

## Cómo leer la tabla

- **Cartas**: número o figura + inicial del palo. `R` rey (12), `C` caballo (11), `S` sota (10),
  `1`–`7` su número; `o` oros, `c` copas, `e` espadas, `b` bastos. Ejemplo: `3c` es el tres de copas.
- Se juega a **8 reyes**: el `3` cuenta como rey y el `2` como as (§1.1).
- **Mano**: asiento que habla primero. El orden de juego es 0 → 1 → 2 → 3 → 0. Parejas: 0 y 2 contra 1 y 3.
- **Gana**: asiento cuya jugada gana el lance (su pareja cobra). `—` si nadie tiene jugada.
- **Tantos**: lo que cobra la pareja ganadora por sus jugadas en el recuento, **sin envites**:
  en pares y juego, la suma de las jugadas de los dos; en punto, 1. En grande y chica depende de las
  apuestas (o del tanto en paso), así que se deja en `—`.

## Casos

| # | Lance | Mano | J0 | J1 | J2 | J3 | Gana | Tantos | Qué comprueba |
|---|---|---|---|---|---|---|---|---|---|
| G01 | grande | 0 | Ro Rc 7o 4o | Re Co So 7c | 7e 6o 5o 4c | Cc Ce Sc 1o | 0 | — | Dos reyes ganan a rey y caballo |
| G02 | grande | 0 | Rb Co 7b 6o | 3o 3c 1o 4o | Cc Ce Cb 7c | Rc So Sc 5o | 1 | — | Los treses son reyes |
| G03 | grande | 2 | Ro Rc 7o 1o | Re 3o 7c 2o | 3c Rb 7e 1c | 4o 4c 4e 5o | 2 | — | Empate a tres: gana la mano |
| G04 | grande | 0 | Co Cc 7o 7c | Ro Ce 6o 1o | So 7e 6c 5o | Rc Cb 6e 2o | 1 | — | Empate entre 1 y 3: gana el más cercano a la mano |
| G05 | grande | 3 | Co Cc 7o 7c | Ro Ce 6o 1o | So 7e 6c 5o | Rc Cb 6e 2o | 3 | — | Mismas cartas que G04 con mano 3 |
| G06 | grande | 1 | Ro Co So 4o | Cc Sc 7o 7c | Rc Ce Se 1o | 7e 6o 6c 5o | 0 | — | Se decide en la última carta |
| G07 | grande | 0 | Ro Rc Re Rb | 3o 3c 3e 3b | Co Cc Ce Cb | So Sc Se Sb | 0 | — | Cuatro reyes contra cuatro treses: empate, gana la mano |
| G08 | grande | 1 | Ro Rc Re Rb | 3o 3c 3e 3b | Co Cc Ce Cb | So Sc Se Sb | 1 | — | Mismas cartas que G07 con mano 1 |
| G09 | grande | 0 | 2o 2c 1o 1c | 4o 4c 1e 1b | 6o 4e 2e 2b | 5c 5e 5b 4b | 2 | — | Los doses son ases; gana la carta más alta |
| G10 | grande | 3 | Ro 7o 6o 5o | Rc 7c 6c 4o | Re 7e 5c 4c | Co Cc Ce Cb | 0 | — | Un rey gana a cuatro caballos |
| G11 | grande | 2 | Ro So 1o 1c | Rc Sc 2o 1e | Co Cc 7o 7c | Re Sb 2c 2e | 3 | — | Empate a tres con mano 2: gana el 3 |
| G12 | grande | 0 | 7o 7c 7e 7b | So 6o 6c 6e | Co 1o 1c 1e | Sc Sb 5o 4o | 2 | — | Un caballo con tres ases gana a cuatro sietes |
| C01 | chica | 0 | 1o 1c 4o 5o | 1e 4c 4e 6o | Ro Rc 7o 6c | 5c 5e 6e 7c | 0 | — | Dos ases ganan a as y cuatro |
| C02 | chica | 0 | 1o 4o 5o 6o | 2o 2c 7o Ro | 4c 5c 6c 7c | Rc Re Co Cc | 1 | — | Los doses son ases |
| C03 | chica | 1 | 1o 1c 2o 4o | Ro Rc Re 7o | 2c 1e 2e 4c | 1b 2b 4e 5o | 2 | — | Empate entre 0 y 2: gana el más cercano a la mano |
| C04 | chica | 0 | 4o 4c 5o 6o | 4e 4b 5c 7o | 5e 6c 7c So | Ro Rc 6e 7e | 0 | — | Se decide en la última carta |
| C05 | chica | 3 | Ro Rc Re Rb | 3o 3c 3e 3b | Co Cc Ce Cb | So Sc Se Sb | 3 | — | Cuatro sotas ganan a la chica |
| C06 | chica | 0 | 1o 7o Ro Rc | 4o 5o 6o 7c | 1c 7e Re 3o | 4c 5c 6c 7b | 0 | — | Empate entre 0 y 2 con mano 0 |
| C07 | chica | 2 | 1o 7o Ro Rc | 4o 5o 6o 7c | 1c 7e Re 3o | 4c 5c 6c 7b | 2 | — | Mismas cartas que C06 con mano 2 |
| C08 | chica | 1 | 1o 1c 1e 1b | 2o 2c 2e 2b | 4o 4c 4e 4b | 5o 5c 5e 5b | 1 | — | Cuatro doses empatan con cuatro ases |
| C09 | chica | 0 | 4o 5o 6o 7o | 1o Ro Rc Re | Co Cc Ce Cb | So Sc Se Sb | 1 | — | Un as gana a 4-5-6-7 aunque lleve tres reyes |
| C10 | chica | 2 | 1o 4o Ro Rc | 1c 4c 7o So | 1e 4e 7c Co | 5o 5c 6o 6c | 1 | — | Se decide en la última carta: sota contra caballo |
| C11 | chica | 0 | 6o 6c 6e 6b | 5o 7o 7c 7e | Ro Rc Re Rb | Co Cc Ce Cb | 1 | — | Un cinco gana a cuatro seises |
| C12 | chica | 3 | 1o 2o 4o 5o | 1c 2c 4c 5c | 1e 2e 4e 5e | 1b 2b 4b 6o | 0 | — | La mano (3) tiene peor chica; empate entre 0, 1 y 2 |
| P01 | pares | 0 | Ro Rc 7o 4o | Co Cc 6o 5o | 7c 6c 5c 4c | So 1o 4e 5e | 0 | 1 | Pareja de reyes gana a pareja de caballos |
| P02 | pares | 0 | Ro Rc 7o 4o | Co Cc Ce 5o | 7c 7e 5c 4c | So 1o 4e 6o | 1 | 2 | Medias ganan a pareja |
| P03 | pares | 0 | Ro Rc Re 4o | Co Cc So Sc | 7o 7c 5o 5c | 1o 4c 6o Ce | 1 | 3 | Duples ganan a medias; caballos y sotas a sietes y cincos |
| P04 | pares | 1 | Ro Rc 1o 1c | Co Cc Ce Cb | So Sc 7o 4o | 6o 6c 5o 4c | 0 | 4 | Duples por la pareja alta: reyes y ases ganan a cuatro caballos |
| P05 | pares | 0 | Ro Rc Re Rb | 3o 3c Co Cc | 1o 4o 6o So | 5o 5c 7o 7c | 0 | 3 | Cuatro reyes son los duples más altos |
| P06 | pares | 0 | 3o Ro 7o 4o | Co Cc 7c 4c | 1o 5o 6o So | 1c 5c 6c Sc | 0 | 1 | Un tres y un rey hacen pareja de reyes |
| P07 | pares | 0 | 2o 1o 7o 4o | 4c 4e 6o 7c | Ro Co So 5o | Rc Cc Sc 5c | 1 | 1 | Un dos y un as hacen pareja de ases; pareja de cuatros gana |
| P08 | pares | 2 | Ro Rc 7o 4o | 1o 4c 6o So | Re Rb 7c 5o | Co 5c 6c 7e | 2 | 2 | Solo una pareja tiene pares: cobra la suma de los dos |
| P09 | pares | 0 | Ro Co So 7o | Rc Cc Sc 7c | 1o 4o 5o 6o | 1c 4c 5c 6c | — | — | Nadie tiene pares: no se juega |
| P10 | pares | 0 | Ro Rc 7o 4o | 3o 3c 6o 5o | 1o 4c 5c Co | 1c 4e 6c So | 0 | 1 | Empate de parejas de reyes: gana la mano |
| P11 | pares | 1 | Ro Rc 7o 4o | 3o 3c 6o 5o | 1o 4c 5c Co | 1c 4e 6c So | 1 | 1 | Mismas cartas que P10 con mano 1 |
| P12 | pares | 0 | 7o 7c 7e 4o | So Sc 1o 1c | Ro Rc 5o 4c | Co 6o 5c 4e | 1 | 3 | Duples bajos ganan a medias |
| P13 | pares | 3 | Ro Rc Re 5o | Co Cc Ce 4o | 7o 7c 1o 1c | 3o 3c 3e 4c | 2 | 5 | La pareja ganadora cobra las jugadas de los dos (3 + 2) |
| P14 | pares | 0 | Ro Rc Re 5o | 3o 3c 3e 4o | 1o 4c 6o So | 1c 5c 6c Sc | 0 | 2 | Empate de medias de reyes: gana la mano |
| J01 | juego | 0 | Ro Co So 1o | Rc Cc Sc 7o | 4o 5o 6o 7c | Re Ce 5c 6c | 0 | 3 | Todas las 31 valen igual: gana la mano |
| J02 | juego | 0 | Ro Co So 6o | Rc Cc Sc 2o | Re Ce 6c 6e | 4o 5o 7o 1c | 1 | 3 | La 31 gana a todo |
| J03 | juego | 0 | Ro Rc Co Cc | Re Ce Se 7o | 4o 5o 6o 1o | 4c 5c 6c 1c | 0 | 2 | 40 gana a 37 |
| J04 | juego | 0 | Ro Rc 6o 6c | Co Cc Ce Cb | 4o 5o 6e 7o | Re Sb 7c 6b | 0 | 2 | 32 gana a 40 |
| J05 | juego | 0 | Ro Co 7o 6o | Rc Cc 7c 7e | 1o 4o 5o 6c | 1c 4c 5c 6e | 1 | 2 | 34 gana a 33 |
| J06 | juego | 0 | Ro Co So 7o | Rc Cc Sc 6o | 1o 4o 5o 6c | 1c 4c 5c 6e | 0 | 2 | 37 gana a 36 |
| J07 | juego | 2 | Ro Co So 1o | 4o 5o 6o 7o | Rc Cc Sc 2o | 4c 5c 6c 7c | 2 | 6 | Solo una pareja tiene juego: cobra 3 + 3 |
| J08 | juego | 0 | Ro Co 5o 4o | Rc 7o 7c 1o | So 6o 6c 4c | Cc 5c 5e 1c | — | — | Nadie tiene juego: se juega al punto |
| J09 | juego | 0 | 3o 3c 3e 1o | Ro Rc Re 4o | Co 5o 6o 7o | Cc 5c 6c 7c | 0 | 3 | Los treses valen 10 |
| J10 | juego | 0 | Ro Rc 7o 4o | Re Rb 7c 4c | 3o 3c 7e 4e | Co Cc 7b 4b | 0 | 6 | Cuatro 31: gana la mano y su pareja cobra 3 + 3 |
| J11 | juego | 3 | Ro Rc 7o 4o | Re Rb 7c 4c | 3o 3c 7e 4e | Co Cc 7b 4b | 3 | 6 | Mismas cartas que J10 con mano 3 |
| J12 | juego | 0 | Ro Co So Sc | Rc Cc 7o 6o | 4o 5o 6c 1o | 4c 5c 6e 1c | 0 | 2 | 40 gana a 33 |
| J13 | juego | 1 | Ro Co So 6o | Rc Cc Sc 5o | Re Ce 7o 6c | Rb Cb Se 4o | 0 | 4 | 36 gana a 35, 34 y 33; la pareja cobra 2 + 2 |
| J14 | juego | 0 | Ro Co So 1o | Rc 7o 7c 7e | 1c 4o 5o 6o | Cc Sc 6c 5c | 0 | 3 | Una 31 con tres sietes vale lo mismo |
| U01 | punto | 0 | Ro Co 7o 2o | Rc Cc 5o 4o | So 6o 6c 4c | Sc 7c 5c 1o | 1 | 1 | Gana la suma más alta: 29 |
| U02 | punto | 0 | Ro Co 5o 5c | Rc Cc 6o 4o | So 7o 1o 1c | Sc 7c 4c 1e | 0 | 1 | Empate a 30: gana la mano |
| U03 | punto | 1 | Ro Co 5o 5c | Rc Cc 6o 4o | So 7o 1o 1c | Sc 7c 4c 1e | 1 | 1 | Mismas cartas que U02 con mano 1 |
| U04 | punto | 0 | 1o 1c 2o 2c | 1e 1b 2e 4o | 2b 4c 5o 6o | 4e 4b 5c 6c | 3 | 1 | Punto con manos bajas |
| U05 | punto | 2 | Ro Co 4o 5o | Rc So 4c 5c | Re 7o 6o 6c | Cc 7c 6e 1o | 2 | 1 | Empate a tres con 29: gana la mano |
| U06 | punto | 0 | 3o 3c 7o 1o | Ro 7c 6o 4o | Co 6c 5o 5c | So 7e 5e 2o | 0 | 1 | Los treses valen 10 en el punto |
| U07 | punto | 3 | Ro 7o 7c 1o | Rc 7e 6o 1c | Co 6c 5o 4o | Cc 5c 4c 4e | 0 | 1 | Empate entre 0 y 2 con mano 3: gana el 0 |
| U08 | punto | 0 | Ro Co 2o 4o | Rc Cc 7o 1o | Re Ce 7c 1c | So Sc 6o 1e | 1 | 1 | Empate entre 1 y 2 con mano 0: gana el 1 |
| U09 | punto | 1 | Ro 6o 6c 7o | Co So 1o 2o | Rc 4o 5o 6e | Cc 7c 5c 1c | 0 | 1 | 29 gana aunque la mano tenga menos |
| U10 | punto | 0 | Ro Rc 4o 5o | Co Cc 4c 5c | So Sc 4e 5e | 3o 3c 4b 5b | 0 | 1 | Cuatro 29: gana la mano |
