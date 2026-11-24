// Reglas de dependencias entre paquetes del monorepo (CLAUDE.md §4).
// Se ejecuta con `pnpm lint:deps` (incluido en `pnpm lint` y en CI).
//
// Los paquetes del workspace se resuelven a su `dist/` (export de package.json), así que
// las reglas comparan rutas reales: `packages/<nombre>/...` y `apps/<nombre>/...`.
// Solo se restringe el código de `src/`: los archivos de configuración pueden usar @31mus/config.

const SRC = (name) => `^${name}/src/`;
const WORKSPACE = '^(apps|packages)/';
/** Tests y sus helpers (`src/testing/`, fuera del build): pueden usar devDependencies y fs. */
const TEST_FILES = '(\\.test\\.tsx?$|/src/testing/)';

/** @param {string} from @param {string[]} allowed @param {string} comment */
function onlyMayDependOn(name, from, allowed, comment) {
  const allowedPattern = `^(${[from.replace(/\/src\/$/, ''), ...allowed].join('|')})/`;
  return {
    name,
    comment,
    severity: 'error',
    from: { path: from },
    to: { path: WORKSPACE, pathNot: allowedPattern },
  };
}

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // --- Fronteras entre paquetes (§4) ---
    onlyMayDependOn(
      'engine-sin-dependencias',
      SRC('packages/engine'),
      [],
      'engine no depende de nada del monorepo.',
    ),
    onlyMayDependOn(
      'bots-solo-engine',
      SRC('packages/bots'),
      ['packages/engine'],
      'bots solo depende de engine.',
    ),
    onlyMayDependOn(
      'shared-solo-tipos-de-engine',
      SRC('packages/shared'),
      ['packages/engine'],
      'shared solo puede importar (tipos) de engine.',
    ),
    {
      name: 'shared-engine-solo-tipos',
      comment: 'shared puede importar tipos de engine, nunca lógica.',
      severity: 'error',
      from: { path: SRC('packages/shared') },
      to: { path: '^packages/engine/', dependencyTypesNot: ['type-only'] },
    },
    onlyMayDependOn(
      'design-tokens-sin-dependencias',
      SRC('packages/design-tokens'),
      [],
      'design-tokens no depende de nada del monorepo.',
    ),
    onlyMayDependOn(
      'game-engine-bots-shared',
      SRC('apps/game'),
      ['packages/engine', 'packages/bots', 'packages/shared'],
      'game solo depende de engine, bots y shared.',
    ),
    onlyMayDependOn(
      'api-solo-shared',
      SRC('apps/api'),
      ['packages/shared'],
      'api solo depende de shared.',
    ),
    onlyMayDependOn(
      'web-shared-tokens-engine',
      SRC('apps/web'),
      ['packages/shared', 'packages/design-tokens', 'packages/engine'],
      'web depende de shared, design-tokens y (solo presentación) de engine.',
    ),

    // --- Pureza: el código compartido con el navegador o el motor no usa módulos de Node ---
    {
      name: 'paquetes-puros-sin-node',
      comment: 'engine, bots, shared y design-tokens no usan módulos de Node (§2.3).',
      severity: 'error',
      from: {
        path: '^packages/(engine|bots|shared|design-tokens)/src/',
        pathNot: TEST_FILES,
      },
      to: { dependencyTypes: ['core'] },
    },

    // --- Higiene general ---
    {
      name: 'sin-ciclos',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'sin-irresolubles',
      comment: 'Todo import debe resolverse (si falla, ¿falta `pnpm build`?).',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'dependencias-declaradas',
      comment: 'Todo paquete importado debe estar en el package.json correspondiente.',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'src-sin-devdependencies',
      comment: 'El código de producción no importa devDependencies (salvo tipos).',
      severity: 'error',
      from: { path: '^(apps|packages)/[^/]+/src/', pathNot: TEST_FILES },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', '/dist/'] },
    exclude: { path: ['/coverage/', '/\\.turbo/'] },
    tsPreCompilationDeps: true,
    combinedDependencies: false,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
