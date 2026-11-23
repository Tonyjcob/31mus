# ADR-0001 · Stack y cimientos del monorepo

- **Estado:** aceptado
- **Fecha:** 23/11/2026
- **Hito:** H0 · Cimientos del repositorio

## Contexto

31mus necesita una base que priorice calidad, trazabilidad y seguridad (CLAUDE.md §1–§2) antes
de escribir el motor de reglas. El stack de alto nivel ya está fijado en CLAUDE.md §3; este ADR
registra **las versiones concretas** y las decisiones de detalle que se tomaron al montarlo.

## Decisión

### Versiones (consultadas en npm y Docker Hub el 23/11/2026)

| Herramienta | Versión | Motivo |
|---|---|---|
| Node.js | 26 (LTS activa) | `engines` y `.node-version` |
| pnpm | 12.21.0 | `packageManager` + corepack |
| Turborepo | 2.11.13 | |
| TypeScript | **6.0.3** | Ver «TypeScript 7» abajo |
| ESLint / typescript-eslint | 10.15.0 / 8.73.0 | Flat config, `strictTypeChecked` |
| Prettier | 3.10.1 | |
| Vitest | 5.1.1 (+ coverage-v8) | |
| dependency-cruiser | 18.8.0 | La 18.9.0 tenía 1 día: no supera la antigüedad mínima de pnpm |
| Husky / lint-staged / commitlint | 9.1.7 / 17.6.2 / 21.2.4 | |
| gitleaks | 8.30.1 | Binario local (winget) y en CI con checksum |
| Vite / React | 8.3.8 / 19.3.1 | |
| Zod | 4.6.7 | Validación de entradas externas (`shared`) |
| PostgreSQL / Redis | `18-alpine` / `8-alpine` | La 19 ya existe, pero se espera a confirmar el soporte de Prisma (H6) |

### Decisiones de detalle

1. **TypeScript 7 no, por ahora.** TS 7 (compilador nativo en Go) es la versión `latest`, pero
   typescript-eslint exige `<6.1` y dependency-cruiser excluye la 7.0. Se usa 6.0.3 y Dependabot
   ignora el salto de versión mayor. Revisar al cerrar cada fase.
2. **Paquetes internos compilados.** Cada paquete compila con `tsc` a `dist/` y lo expone en
   `exports`. Turborepo ordena el trabajo con `dependsOn: ["^build"]`. Es el modelo que también
   sirve en producción (Node ejecuta `dist/`), sin condiciones de exportación especiales.
3. **ESM y `module: nodenext`** en todo lo que corre en Node (imports relativos con `.js`).
   La web usa `moduleResolution: bundler`.
4. **Reglas de dependencias con dependency-cruiser** (no con `eslint-plugin-import`): valida las
   fronteras entre paquetes con las rutas reales, detecta ciclos, imports irresolubles,
   dependencias no declaradas y módulos de Node en paquetes puros. Se ejecuta en `pnpm lint`.
5. **Pureza también por ESLint.** El perfil `pure` (engine y bots) prohíbe `Math.random`,
   `Date.now`, `new Date()`, timers, `process`, `fetch` e imports de Node. bots también es
   determinista: el azar de los faroles se inyecta y el retardo «humano» lo aplica el servidor.
6. **Apps sin framework en H0.** `api` y `game` son `node:http` con `/` y `/health`.
   NestJS (decoradores, DI) llega en H6 y Colyseus en H3, donde se configuran de verdad.
   `tsx watch` se usa en desarrollo porque soportará esos decoradores sin cambiar de herramienta.
7. **Entorno validado con Zod** en `shared` (`parseEnv`), que nunca imprime los valores.
   Las apps escuchan en `127.0.0.1` por defecto (Windows no muestra el aviso del Firewall);
   dentro de Docker se usará `HOST=0.0.0.0`.
8. **gitleaks**: en el hook `pre-commit` (falla si no está instalado) y en CI con el binario
   oficial verificado por SHA-256, en lugar de `gitleaks-action`, que pide licencia a organizaciones.
9. **Cadena de suministro**: versiones exactas (`saveExact`), lockfile congelado en CI, solo
   `esbuild` puede ejecutar scripts de instalación (`allowBuilds`), actions fijadas por SHA,
   `pnpm audit` en CI y Dependabot con 7 días de espera.
10. **Prettier no formatea Markdown**: la documentación se redacta a mano.

## Alternativas descartadas

- **npm/yarn workspaces o Nx**: pnpm + Turborepo ya estaba decidido; es lo más ligero con caché.
- **Paquetes internos «solo código fuente»** (exports a `src/*.ts` con condiciones
  personalizadas): evita compilar en desarrollo, pero obliga a configurar la condición en tsc,
  Vite, Vitest y tsx, y producción necesitaría compilarlos de todos modos.
- **Ejecutar TS directamente con Node 26** (type stripping): no admite los decoradores de
  NestJS/Colyseus.

## Consecuencias

- `pnpm lint`, `typecheck`, `test` y `dev` compilan antes los paquetes de los que dependen
  (lo gestiona Turborepo, con caché).
- Al añadir un paquete o app hay que darle sus reglas en `.dependency-cruiser.cjs`.
- Cuando typescript-eslint y dependency-cruiser soporten TS 7, se migra en un ADR nuevo.
