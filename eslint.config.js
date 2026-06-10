/**
 * ESLint flat config (ESLint v9+)
 * Kept simple — just the basics for TypeScript.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'tests/fixtures/'],
  },
  {
    // Web frontend — allow `any` for React event handlers and API responses
    files: ['web/**/*.ts', 'web/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
