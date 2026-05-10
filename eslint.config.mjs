// Root ESLint config — lints root-level JS/TS config files only.
// All real source linting is delegated to per-workspace configs.
import tseslint from 'typescript-eslint';

export default tseslint.config({
  // Global ignores across the whole monorepo
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/.turbo/**',
    '**/package-lock.json',
  ],
});
