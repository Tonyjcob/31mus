# Mediciones de los bots (H2)

> Generado por `pnpm --filter @31mus/bots sim` (`packages/bots/src/dod.sim.test.ts`). No editar a
> mano: se regenera al cambiar el ajuste (`packages/bots/src/tuning.ts`) o los personajes.
> Con las mismas semillas y el mismo ajuste, el resultado es idéntico (ADR-0003 §6).

## Partidas bot contra bot

- Partidas: 10.000, sin errores.
- Manos jugadas: 184.767 (18,5 por partida).
- Decisiones: 2.697.438.

## Bot medio contra bot aleatorio

El Bot neutro gana el **96,0 %** de 5000 partidas
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
| El Abuelo | 1,20 | 4,4 % | 0,003 | 10,5 % | 56,7 % |
| La Faraona | 1,57 | 11,0 % | 0,137 | 12,8 % | 54,2 % |
| El Pollo | 1,77 | 22,2 % | 0,031 | 13,4 % | 54,5 % |
| Doña Rosario | 1,48 | 6,3 % | 0,013 | 12,9 % | 32,3 % |
| Bot | 1,46 | 15,9 % | 0,040 | 12,5 % | 53,9 % |

## Enfrentamientos entre personajes

5000 partidas por enfrentamiento, cambiando de pareja la mitad. Victorias del primero;
ninguno puede pasar del 60,0 %.

| Personaje | Contra | Gana |
|---|---|---|
| El Abuelo | La Faraona | 53,9 % |
| El Abuelo | El Pollo | 53,1 % |
| El Abuelo | Doña Rosario | 54,4 % |
| El Abuelo | Bot | 51,8 % |
| La Faraona | El Pollo | 51,0 % |
| La Faraona | Doña Rosario | 48,2 % |
| La Faraona | Bot | 47,5 % |
| El Pollo | Doña Rosario | 48,6 % |
| El Pollo | Bot | 48,0 % |
| Doña Rosario | Bot | 49,1 % |
