/**
 * Unit tests for lib/env-validate.ts.
 * Tests manipulate process.env — each test saves/restores to avoid leakage.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateEnv } from '../env-validate.js';

const REQUIRED = [
  'ANTHROPIC_API_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'FRONTEND_URL',
  'NODE_ENV',
] as const;

let savedEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  savedEnv = process.env;
  // Copy so each test starts from a known state
  process.env = { ...savedEnv };
});

afterEach(() => {
  process.env = savedEnv;
});

describe('validateEnv', () => {
  it('passes when all required vars are present', () => {
    REQUIRED.forEach((key) => { process.env[key] = 'test-value'; });
    process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
    process.env.NODE_ENV = 'test';

    expect(() => validateEnv()).not.toThrow();
  });

  it('throws listing all missing vars when env is empty', () => {
    process.env = {};

    expect(() => validateEnv()).toThrow('Missing required environment variables');
  });

  it('throws naming the specific missing var', () => {
    REQUIRED.forEach((key) => { process.env[key] = 'test-value'; });
    process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
    process.env.NODE_ENV = 'test';
    delete process.env.ANTHROPIC_API_KEY;

    expect(() => validateEnv()).toThrow('ANTHROPIC_API_KEY');
  });

  it('throws when Stripe live key used in non-production', () => {
    REQUIRED.forEach((key) => { process.env[key] = 'test-value'; });
    process.env.STRIPE_SECRET_KEY = 'sk_live_xxx';
    process.env.NODE_ENV = 'development';

    expect(() => validateEnv()).toThrow('must be a test key');
  });

  it('allows Stripe live key in production', () => {
    REQUIRED.forEach((key) => { process.env[key] = 'test-value'; });
    process.env.STRIPE_SECRET_KEY = 'sk_live_xxx';
    process.env.NODE_ENV = 'production';

    expect(() => validateEnv()).not.toThrow();
  });
});
