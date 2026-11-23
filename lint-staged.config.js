// Se ejecuta en el hook pre-commit sobre los archivos preparados.
// ESLint busca el eslint.config.js más cercano a cada archivo (el de su paquete).
export default {
  '*.{ts,tsx}': ['eslint --max-warnings=0 --no-warn-ignored', 'prettier --write'],
  '*.{js,cjs,mjs,json,yml,yaml,css,html}': 'prettier --write',
};
