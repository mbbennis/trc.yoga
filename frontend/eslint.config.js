import eslint from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

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
          navigator: "readonly",
        }
      },
      plugins: {
        'simple-import-sort': simpleImportSort,
      },
      rules: {
        // Alphabetically sort imports
        'simple-import-sort/imports': 'error',
        'simple-import-sort/exports': 'error',
      }
    },
  ],
  prettierRecommended,
);