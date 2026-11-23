// Conventional Commits (CLAUDE.md §5): `tipo(scope): descripción en español`.
const SCOPES = [
  'engine',
  'bots',
  'shared',
  'design-tokens',
  'config',
  'web',
  'api',
  'game',
  'infra',
  'docs',
  'ci',
  'deps',
  'repo',
];

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', SCOPES],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],
  },
};
