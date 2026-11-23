# 31mus

Mus online (variante de 8 reyes) en español: partidas contra bots con personaje, salas públicas y
privadas, modo espectador y clasificatoria 2 vs 2 por ELO.

> Proyecto en desarrollo. Estado de los hitos en [`docs/HITOS.md`](docs/HITOS.md).

## Requisitos

- **Node.js 26** (ver `.node-version`) con **corepack** activo: `corepack enable`
- **Docker Desktop** en marcha (PostgreSQL y Redis de desarrollo)
- **gitleaks** (lo usa el hook de pre-commit): `winget install --id Gitleaks.Gitleaks`
- Git

## Puesta en marcha (PowerShell)

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env   # y cambia la contraseña de PostgreSQL
pnpm dev
```

`pnpm dev` levanta PostgreSQL y Redis con Docker y arranca las apps en modo watch:

| App | URL |
|---|---|
| Web | http://127.0.0.1:5173 |
| API | http://127.0.0.1:3000/health |
| Servidor de juego | http://127.0.0.1:2567/health |

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Infraestructura Docker + todas las apps en watch |
| `pnpm lint` | ESLint, reglas de dependencias entre paquetes y Prettier |
| `pnpm typecheck` | Comprobación de tipos de todo el monorepo |
| `pnpm test` | Todos los tests (el motor exige cobertura ≥ 95 %) |
| `pnpm test:engine` | Solo los tests del motor |
| `pnpm build` | Compila paquetes y apps |
| `pnpm format` | Formatea con Prettier |
| `pnpm infra:up` / `pnpm infra:down` | Arranca / para PostgreSQL y Redis |

## Estructura

```
apps/       web (React + Vite) · api (REST) · game (tiempo real)
packages/   engine (reglas) · bots · shared · design-tokens · config
docs/       HITOS, REGLAS_MUS, DISENO, ARQUITECTURA y ADR
```

Más detalle en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md). Las normas de trabajo están en
[`CLAUDE.md`](CLAUDE.md).

## Licencia

Código: **todos los derechos reservados** (ver [`LICENSE`](LICENSE)). El repositorio es público
solo para su consulta. Los recursos de terceros de `assets/` mantienen su propia licencia.
