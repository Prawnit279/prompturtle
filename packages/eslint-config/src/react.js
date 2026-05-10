// @ts-check
import pluginJsxA11y from 'eslint-plugin-jsx-a11y';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginReactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import { base } from './base.js';

/** @type {import('typescript-eslint').ConfigArray} */
export const react = [
  ...base,
  pluginReact.configs.flat.recommended,
  pluginJsxA11y.flatConfigs.recommended,
  {
    plugins: {
      'react-hooks': pluginReactHooks,
      'react-refresh': pluginReactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React 17+ JSX transform — no need to import React
      'react/react-in-jsx-scope': 'off',
      // TypeScript covers prop validation
      'react/prop-types': 'off',
      // Hooks rules
      ...pluginReactHooks.configs.recommended.rules,
      // Vite HMR safety
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
];
