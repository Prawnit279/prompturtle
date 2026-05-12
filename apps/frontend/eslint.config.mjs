import { react } from '@prompturtle/eslint-config/react';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...react,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Root-level config files are not in tsconfig — disable type-aware
    // rules AND opt out of projectService so the parser doesn't error.
    files: ['*.mjs', '*.js', '*.ts'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: ['dist/**', 'coverage/**', '.turbo/**'],
  },
);
