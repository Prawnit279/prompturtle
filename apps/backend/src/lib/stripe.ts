import Stripe from 'stripe';

// Singleton — import this everywhere instead of constructing Stripe directly.
// Throws at startup if the key is missing or is a live key.
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  throw new Error(
    'STRIPE_SECRET_KEY must be a TEST key (sk_test_). Production keys are not permitted in this codebase without explicit approval.',
  );
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});
