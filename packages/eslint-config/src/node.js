// @ts-check
import pluginN from 'eslint-plugin-n';
import globals from 'globals';
import { base } from './base.js';

/** @type {import('typescript-eslint').ConfigArray} */
export const node = [
  ...base,
  {
    plugins: { n: pluginN },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'n/no-process-exit': 'error',
      'n/no-deprecated-api': 'error',
      // Relax console restriction for server-side code
      'no-console': 'off',
    },
  },
];
