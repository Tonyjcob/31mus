# Mediciones de los bots (H2)

> Generado por `pnpm --filter @31mus/bots sim` (`packages/bots/src/dod.sim.test.ts`). No editar a
> mano: se regenera al cambiar el ajuste (`packages/bots/src/tuning.ts`) o los personajes.
> Con las mismas semillas y el mismo ajuste, el resultado es idéntico (ADR-0003 §6).

## Partidas bot contra bot

- Partidas: 10.000, sin errores.
- Manos jugadas: 181.542 (18,2 por partida).
- Decisiones: 2.698.898.

## Bot medio contra bot aleatorio

El Bot neutro gana el **96,1 %** de 5000 partidas
(cambiando de pareja la mitad). Mínimo exigido: 70,0 %.

## Estilo de cada personaje

2000 partidas de cada personaje (los dos asientos de una pareja) contra el Bot neutro. Por pareja:

- **Envites por mano**: envites y subidas (sin órdagos).
- **Faroles**: parte de los envites, subidas y órdagos hechos con mano floja.
- **Órdagos por mano**.
- **Quiere**: parte de las respuestas a una apuesta que son «quiero».
- **Corta**: parte de las decisiones de mus que son «corto».

| Personaje | Envites por mano | Faroles | Órdagos por mano | Quiere | Corta |
|---|---|---|---|---|---|
| El Abuelo | 1,22 | 4,3 % | 0,003 | 10,9 % | 52,9 % |
| La Faraona | 1,60 | 10,8 % | 0,138 | 13,0 % | 49,6 % |
| El Pollo | 1,78 | 21,8 % | 0,032 | 13,6 % | 49,5 % |
| Doña Rosario | 1,51 | 6,0 % | 0,014 | 12,9 % | 32,0 % |
| Bot | 1,49 | 15,2 % | 0,041 | 12,7 % | 49,3 % |

## Enfrentamientos entre personajes

5000 partidas por enfrentamiento, cambiando de pareja la mitad. Victorias del primero;
ninguno puede pasar del 60,0 %.

| Personaje | Contra | Gana |
|---|---|---|
| El Abuelo | La Faraona | 53,7 % |
| El Abuelo | El Pollo | 54,6 % |
| El Abuelo | Doña Rosario | 54,3 % |
| El Abuelo | Bot | 52,0 % |
| La Faraona | El Pollo | 51,1 % |
| La Faraona | Doña Rosario | 48,0 % |
| La Faraona | Bot | 47,6 % |
| El Pollo | Doña Rosario | 49,0 % |
| El Pollo | Bot | 46,6 % |
| Doña Rosario | Bot | 49,2 % |
