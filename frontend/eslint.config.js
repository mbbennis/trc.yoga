import eslint from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
);