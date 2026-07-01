import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import importPlugin from 'eslint-plugin-import'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'
import nextPlugin from '@next/eslint-plugin-next'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import prettierConfig from 'eslint-config-prettier'
import jsoncPlugin from 'eslint-plugin-jsonc'
import * as jsoncParser from 'jsonc-eslint-parser'

const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'dist/**',
      'coverage/**',
      'public/**',
    ],
  },
  // React configuration
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@next/next': nextPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      // Only use the standard hooks rules, not the React Compiler rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Disable prop-types - TypeScript handles this
      'react/prop-types': 'off',
      // Allow display name to be inferred
      'react/display-name': 'off',
      // Allow unescaped entities (Next.js default)
      'react/no-unescaped-entities': 'off',
      // Allow styled-jsx properties (jsx, global)
      'react/no-unknown-property': ['error', { ignore: ['jsx', 'global'] }],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  // Prettier config (disables conflicting rules)
  prettierConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        // Type-aware linting: pull type info from the nearest tsconfig per file
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
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

      // Fail the build when a switch over a union/enum misses a member. A bare
      // default doesn't count as coverage, so every member needs its own case;
      // a `default: assertNever(x)` guard stays legal on an already-exhaustive switch.
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: false },
      ],
    },
  },
  // App dir tweak - prefer default exports (except API routes)
  {
    files: ['src/app/**/*.{js,ts,jsx,tsx}'],
    ignores: ['src/app/api/**/*.{js,ts,jsx,tsx}'],
    rules: {
      'import/prefer-default-export': 'error',
    },
  },
  // i18n translation files - enforce sorted keys for consistency
  {
    files: ['messages/*.json'],
    languageOptions: {
      parser: jsoncParser,
    },
    plugins: {
      jsonc: jsoncPlugin,
    },
    rules: {
      // Sort all keys alphabetically (recursive, case-insensitive, ascending)
      'jsonc/sort-keys': [
        'error',
        {
          pathPattern: '.*',
          order: { type: 'asc', caseSensitive: false, natural: true },
        },
      ],
    },
  },
]

export default config
