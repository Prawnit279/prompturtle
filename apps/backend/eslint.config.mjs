import { node } from '@prompturtle/eslint-config/node';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...node,
  {
    files: ['src/**/*.ts'],
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
    // Relax rules in test files
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // Vitest mock references are unbound by design
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    ignores: ['dist/**', 'coverage/**', '.turbo/**'],
  },
);
