import { react } from '@prompturtle/eslint-config/react';
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
    // Disable type-aware rules for config files not in tsconfig
    files: ['*.mjs', '*.js'],
    ...tseslint.configs.disableTypeChecked,
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
