// Configuración compartida de ESLint (flat config) para todo el monorepo.
// Cada paquete la usa con `createConfig({ tsconfigRootDir: import.meta.dirname, profile })`.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @typedef {'pure' | 'library' | 'node' | 'react'} Profile */

/** Prohibido en todo el monorepo (CLAUDE.md §5). */
const COMMON_SYNTAX = [
  {
    selector: 'TSEnumDeclaration',
    message: 'Sin enum de TS: usa una unión literal `as const` (CLAUDE.md §5).',
  },
];

/** Módulos de Node: prohibidos en código que no se ejecuta solo en Node. */
const NODE_MODULES_PATTERN = {
  group: ['node:*', 'fs', 'fs/*', 'path', 'os', 'http', 'https', 'net', 'crypto', 'child_process'],
  message: 'Este paquete no puede depender de módulos de Node.',
};

/**
 * Reglas del motor puro (CLAUDE.md §2.3): sin I/O, sin tiempo ni azar implícitos.
 * El azar y el tiempo se inyectan.
 */
const PURE_RULES = {
  'no-restricted-imports': ['error', { patterns: [NODE_MODULES_PATTERN] }],
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: 'Inyecta un Rng; nada de Math.random.' },
    { object: 'Date', property: 'now', message: 'El tiempo se inyecta; nada de Date.now.' },
    { object: 'crypto', property: 'randomInt', message: 'El azar se inyecta con un Rng.' },
    { object: 'crypto', property: 'getRandomValues', message: 'El azar se inyecta con un Rng.' },
  ],
  'no-restricted-globals': [
    'error',
    ...['setTimeout', 'setInterval', 'setImmediate', 'fetch', 'process', 'performance'].map(
      (name) => ({ name, message: `El motor es puro: \`${name}\` no está permitido.` }),
    ),
  ],
  'no-restricted-syntax': [
    'error',
    ...COMMON_SYNTAX,
    {
      selector: "NewExpression[callee.name='Date']",
      message: 'El tiempo se inyecta; nada de new Date().',
    },
  ],
  'no-console': 'error',
};

/** @param {Profile} profile */
function profileConfig(profile) {
  switch (profile) {
    case 'pure':
      return { languageOptions: { globals: {} }, rules: PURE_RULES };
    case 'library':
      return {
        languageOptions: { globals: {} },
        rules: {
          'no-restricted-imports': ['error', { patterns: [NODE_MODULES_PATTERN] }],
          'no-console': 'error',
        },
      };
    case 'node':
      return { languageOptions: { globals: { ...globals.node } } };
    case 'react':
      return {
        languageOptions: { globals: { ...globals.browser } },
        plugins: { 'react-hooks': reactHooks },
        rules: {
          ...reactHooks.configs.recommended.rules,
          'no-restricted-syntax': [
            'error',
            ...COMMON_SYNTAX,
            {
              selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
              message: 'Prohibido dangerouslySetInnerHTML (CLAUDE.md §11).',
            },
          ],
        },
      };
    default:
      throw new Error(`Perfil de ESLint desconocido: ${String(profile)}`);
  }
}

/**
 * @param {{ tsconfigRootDir: string, profile: Profile }} options
 */
export function createConfig({ tsconfigRootDir, profile }) {
  return defineConfig(
    globalIgnores(['**/dist/**', '**/coverage/**', '**/.turbo/**', '**/node_modules/**']),
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      linterOptions: { reportUnusedDisableDirectives: 'error' },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/consistent-type-exports': 'error',
        '@typescript-eslint/switch-exhaustiveness-check': [
          'error',
          { considerDefaultExhaustiveForUnions: true, requireDefaultForNonUnion: true },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/ban-ts-comment': [
          'error',
          { 'ts-expect-error': 'allow-with-description', minimumDescriptionLength: 10 },
        ],
        'no-restricted-syntax': ['error', ...COMMON_SYNTAX],
        eqeqeq: ['error', 'always'],
      },
    },
    profileConfig(profile),
    {
      // Archivos de configuración en JS: sin reglas que necesitan tipos.
      files: ['**/*.{js,cjs,mjs}'],
      extends: [tseslint.configs.disableTypeChecked],
      languageOptions: { globals: { ...globals.node } },
      rules: { 'no-restricted-imports': 'off', 'no-restricted-globals': 'off' },
    },
    prettier,
  );
}
