import { node } from '@prompturtle/eslint-config/node';
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
    // Disable type-aware rules for root-level config files not in tsconfig
    files: ['*.mjs', '*.js', '*.ts'],
    ...tseslint.configs.disableTypeChecked,
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
