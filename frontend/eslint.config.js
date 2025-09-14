import eslint from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tsParser from '@typescript-eslint/parser';
import vueParser from 'vue-eslint-parser';

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  [
    {
      files: ['**/*.{js,ts,vue}'],
      languageOptions: {
        globals: {
          console: "readonly",
          fetch: "readonly",
          navigator: "readonly",
        },
        parser: tsParser,
      },
      plugins: {
        'simple-import-sort': simpleImportSort,
      },
      rules: {
        // Alphabetically sort imports
        'simple-import-sort/imports': 'error',
        'simple-import-sort/exports': 'error',
      },
    },
    {
      files: ['**/*.vue'],
      languageOptions: {
        parser: vueParser,
        parserOptions: {
          parser: '@typescript-eslint/parser',
          extraFileExtensions: ['.vue'],
          ecmaVersion: 2021,
          sourceType: 'module',
        },
      },
    },
  ],
  prettierRecommended,
);