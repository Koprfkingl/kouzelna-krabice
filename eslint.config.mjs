// npm run lint: catches names that are used but never defined or imported (easy to miss across modules).
import globals from 'globals';

const rules = { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }] };
export default [
  { ignores: ['www/vendor/**'] },
  { files: ['www/**/*.js'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser }, rules },
  { files: ['tests/**/*.mjs', 'scripts/**/*.mjs'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node, ...globals.browser } }, rules },
];
