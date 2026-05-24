/**
 * Called once at startup. Throws immediately if any required environment
 * variable is missing — fail fast rather than surface cryptic errors later.
 */

const REQUIRED_VARS = [
  'ANTHROPIC_API_KEY',
  'DATABASE_URL',
  // DIRECT_URL is used by Prisma CLI for migrations. Required here so that
  // misconfigured deployments surface immediately rather than at first DB call.
  'DIRECT_URL',
  'CLERK_SECRET_KEY',
  // CLERK_PUBLISHABLE_KEY is technically frontend-only but should be
  // co-located in the same .env so deployments stay in sync.
  'CLERK_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'FRONTEND_URL',
  'NODE_ENV',
] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}\n\nCheck .env.example for the full list.`,
    );
  }

  // Extra: block live Stripe keys outside of production
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.STRIPE_SECRET_KEY &&
    !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')
  ) {
    throw new Error(
      'STRIPE_SECRET_KEY must be a test key (sk_test_) in non-production environments.',
    );
  }
}
