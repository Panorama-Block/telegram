// @ts-check
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'import/order': [
        'warn',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index']],
        },
      ],
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  eslintConfigPrettier,
];


