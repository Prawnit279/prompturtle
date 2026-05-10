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
    // Disable type-aware rules for config files not in tsconfig
    files: ['*.mjs', '*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    ignores: ['dist/**', 'coverage/**', '.turbo/**'],
  },
);
