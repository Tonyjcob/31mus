/**
 * Simulación completa de la DoD de H2 (ADR-0003 §6): `pnpm --filter @31mus/bots sim`. Tarda unos 10
 * minutos, así que no corre en cada commit. Escribe los resultados en docs/bots/MEDICIONES.md:
 * con las mismas semillas y el mismo ajuste, el fichero sale idéntico.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { decideAction } from './decide.js';
import { BOT_PERSONAS, NEUTRAL_PERSONA } from './personas.js';
import { pairs, randomPlayer, simulateMatch } from './testing/simulate.js';
import type { Player, TeamStats } from './testing/simulate.js';
import type { BotPersona } from './types.js';

const BOT_MATCHES = 10_000;
const VERSUS_RANDOM_MATCHES = 5_000;
const MIN_WIN_RATE_VS_RANDOM = 0.7;
const STYLE_MATCHES = 2_000;
const MATRIX_MATCHES = 5_000;
const MAX_WIN_RATE_BETWEEN_PERSONAS = 0.6;
const TIMEOUT_MS = 1_800_000;
/** Semillas separadas por bloque para que los bloques no compartan partidas. */
const SEEDS = { bots: 0, random: 100_000, style: 200_000, matrix: 300_000 } as const;

const REPORT = fileURLToPath(new URL('../../../docs/bots/MEDICIONES.md', import.meta.url));

const bot =
  (persona: BotPersona): Player =>
  (input) =>
    decideAction({ ...input, persona });

function personaAt(index: number): BotPersona {
  const persona = BOT_PERSONAS[index % BOT_PERSONAS.length];
  if (persona === undefined) throw new RangeError('Catálogo vacío.');
  return persona;
}

const dec = (x: number, digits = 2) => x.toFixed(digits).replace('.', ',');
const pct = (x: number) => `${dec(x * 100, 1)} %`;

/** Juega `count` partidas de `a` contra `b`, cambiando de pareja la mitad: victorias de `a`. */
function versus(a: Player, b: Player, count: number, seed: number) {
  let wins = 0;
  for (let i = 0; i < count; i++) {
    const aTeam = i % 2 === 0 ? 0 : 1;
    const players = aTeam === 0 ? pairs(a, b) : pairs(b, a);
    if (simulateMatch(players, seed + i).winner === aTeam) wins++;
  }
  return wins / count;
}

interface StyleRow {
  readonly persona: BotPersona;
  readonly hands: number;
  readonly stats: TeamStats;
}

const report = {
  bots: { matches: 0, hands: 0, decisions: 0 },
  versusRandom: 0,
  styles: [] as StyleRow[],
  matrix: [] as { a: string; b: string; rate: number }[],
};

describe('DoD de H2', () => {
  it(
    `${String(BOT_MATCHES)} partidas bot contra bot sin errores`,
    () => {
      for (let i = 0; i < BOT_MATCHES; i++) {
        const players = [0, 1, 2, 3].map((s) => bot(personaAt(i + s))) as [
          Player,
          Player,
          Player,
          Player,
        ];
        const { hands, stats } = simulateMatch(players, SEEDS.bots + i);
        report.bots.matches++;
        report.bots.hands += hands;
        report.bots.decisions += stats[0].decisions + stats[1].decisions;
      }
      expect(report.bots.matches).toBe(BOT_MATCHES);
    },
    TIMEOUT_MS,
  );

  it(
    `el bot medio gana al aleatorio al menos el ${pct(MIN_WIN_RATE_VS_RANDOM)}`,
    () => {
      report.versusRandom = versus(
        bot(NEUTRAL_PERSONA),
        randomPlayer,
        VERSUS_RANDOM_MATCHES,
        SEEDS.random,
      );
      expect(report.versusRandom).toBeGreaterThanOrEqual(MIN_WIN_RATE_VS_RANDOM);
    },
    TIMEOUT_MS,
  );

  it(
    'cada personaje tiene un estilo medible distinto',
    () => {
      for (const persona of BOT_PERSONAS) {
        const stats: TeamStats = {
          decisions: 0,
          bets: 0,
          bluffs: 0,
          ordagos: 0,
          quieros: 0,
          noQuieros: 0,
          cuts: 0,
          musCalls: 0,
        };
        let hands = 0;
        for (let i = 0; i < STYLE_MATCHES; i++) {
          // El personaje en la pareja 0, contra el bot neutro.
          const result = simulateMatch(pairs(bot(persona), bot(NEUTRAL_PERSONA)), SEEDS.style + i);
          hands += result.hands;
          for (const key of Object.keys(stats) as (keyof TeamStats)[]) {
            stats[key] += result.stats[0][key];
          }
        }
        report.styles.push({ persona, hands, stats });
      }
      const by = (id: string) => {
        const row = report.styles.find((r) => r.persona.id === id);
        if (row === undefined) throw new RangeError(`Falta ${id}.`);
        return row;
      };
      const perHand = (id: string, key: keyof TeamStats) => by(id).stats[key] / by(id).hands;
      const bluffShare = (id: string) =>
        by(id).stats.bluffs / (by(id).stats.bets + by(id).stats.ordagos);
      const cutRate = (id: string) =>
        by(id).stats.cuts / (by(id).stats.cuts + by(id).stats.musCalls);
      const callRate = (id: string) =>
        by(id).stats.quieros / (by(id).stats.quieros + by(id).stats.noQuieros);
      // La Faraona ordaga más que nadie; El Abuelo, menos.
      expect(perHand('faraona', 'ordagos')).toBeGreaterThan(perHand('neutro', 'ordagos'));
      expect(perHand('abuelo', 'ordagos')).toBeLessThan(perHand('neutro', 'ordagos'));
      // El Pollo va de farol más que nadie; El Abuelo, casi nunca.
      expect(bluffShare('pollo')).toBeGreaterThan(bluffShare('neutro'));
      expect(bluffShare('abuelo')).toBeLessThan(bluffShare('neutro'));
      // Doña Rosario pide mus más que nadie.
      expect(cutRate('rosario')).toBeLessThan(cutRate('neutro'));
      // El Abuelo quiere menos que La Faraona.
      expect(callRate('abuelo')).toBeLessThan(callRate('faraona'));
    },
    TIMEOUT_MS,
  );

  it(
    `ningún personaje gana a otro más del ${pct(MAX_WIN_RATE_BETWEEN_PERSONAS)}`,
    () => {
      BOT_PERSONAS.forEach((a, i) => {
        BOT_PERSONAS.slice(i + 1).forEach((b, j) => {
          const seed = SEEDS.matrix + (i * BOT_PERSONAS.length + j) * MATRIX_MATCHES;
          report.matrix.push({
            a: a.id,
            b: b.id,
            rate: versus(bot(a), bot(b), MATRIX_MATCHES, seed),
          });
        });
      });
      for (const { rate } of report.matrix) {
        expect(rate).toBeLessThanOrEqual(MAX_WIN_RATE_BETWEEN_PERSONAS);
        expect(rate).toBeGreaterThanOrEqual(1 - MAX_WIN_RATE_BETWEEN_PERSONAS);
      }
    },
    TIMEOUT_MS,
  );
});

function renderReport(): string {
  const name = (id: string) => BOT_PERSONAS.find((p) => p.id === id)?.name ?? id;
  const styleRows = report.styles.map(({ persona, hands, stats }) => {
    const bets = stats.bets + stats.ordagos;
    return `| ${persona.name} | ${dec(stats.bets / hands)} | ${pct(stats.bluffs / bets)} | ${dec(stats.ordagos / hands, 3)} | ${pct(stats.quieros / (stats.quieros + stats.noQuieros))} | ${pct(stats.cuts / (stats.cuts + stats.musCalls))} |`;
  });
  const matrixRows = report.matrix.map(
    ({ a, b, rate }) => `| ${name(a)} | ${name(b)} | ${pct(rate)} |`,
  );
  return `# Mediciones de los bots (H2)

> Generado por \`pnpm --filter @31mus/bots sim\` (\`packages/bots/src/dod.sim.test.ts\`). No editar a
> mano: se regenera al cambiar el ajuste (\`packages/bots/src/tuning.ts\`) o los personajes.
> Con las mismas semillas y el mismo ajuste, el resultado es idéntico (ADR-0003 §6).

## Partidas bot contra bot

- Partidas: ${report.bots.matches.toLocaleString('es-ES')}, sin errores.
- Manos jugadas: ${report.bots.hands.toLocaleString('es-ES')} (${dec(report.bots.hands / Math.max(1, report.bots.matches), 1)} por partida).
- Decisiones: ${report.bots.decisions.toLocaleString('es-ES')}.

## Bot medio contra bot aleatorio

El Bot neutro gana el **${pct(report.versusRandom)}** de ${VERSUS_RANDOM_MATCHES.toLocaleString('es-ES')} partidas
(cambiando de pareja la mitad). Mínimo exigido: ${pct(MIN_WIN_RATE_VS_RANDOM)}.

## Estilo de cada personaje

${STYLE_MATCHES.toLocaleString('es-ES')} partidas de cada personaje (los dos asientos de una pareja) contra el Bot neutro. Por pareja:

- **Envites por mano**: envites y subidas (sin órdagos).
- **Faroles**: parte de los envites, subidas y órdagos hechos con mano floja.
- **Órdagos por mano**.
- **Quiere**: parte de las respuestas a una apuesta que son «quiero».
- **Corta**: parte de las decisiones de mus que son «corto».

| Personaje | Envites por mano | Faroles | Órdagos por mano | Quiere | Corta |
|---|---|---|---|---|---|
${styleRows.join('\n')}

## Enfrentamientos entre personajes

${MATRIX_MATCHES.toLocaleString('es-ES')} partidas por enfrentamiento, cambiando de pareja la mitad. Victorias del primero;
ninguno puede pasar del ${pct(MAX_WIN_RATE_BETWEEN_PERSONAS)}.

| Personaje | Contra | Gana |
|---|---|---|
${matrixRows.join('\n')}
`;
}

afterAll(() => {
  writeFileSync(REPORT, renderReport());
});
