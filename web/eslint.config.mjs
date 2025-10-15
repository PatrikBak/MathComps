import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import importPlugin from 'eslint-plugin-import'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
})

const config = [
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
  {
    ignores: ['**/node_modules/**', '.next/**', 'dist/**', 'out/**', 'coverage/**', 'public/**'],
  },
  ...compat.config({
    extends: ['next/core-web-vitals', 'prettier'],
  }),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      // Imports
      'import/exports-last': 'off',
      'import/prefer-default-export': 'off',
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',

      // TypeScript niceties
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }, // App dir tweak - prefer default exports
  {
    files: ['src/app/**/*.{js,ts,jsx,tsx}'],
    rules: {
      'import/prefer-default-export': 'error',
    },
  },
]

export default config
