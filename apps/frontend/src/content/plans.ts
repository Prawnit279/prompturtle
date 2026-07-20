/**
 * Canonical plan presentation — the single source of truth for BOTH the
 * marketing pricing section and the dashboard billing page, so what we promise
 * and what we deliver can never drift.
 *
 * IMPORTANT: the call/rate numbers here must match the enforced backend
 * `TIER_LIMITS` (packages/shared/src/types/tenant.ts). The frontend doesn't
 * depend on the shared package, so they're mirrored here by hand — keep them
 * in sync if TIER_LIMITS changes.
 */

export type PlanTier = 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';

/** Env var holding each paid tier's Stripe price id (used by the dashboard checkout). */
export type StripeEnvKey = 'STARTER' | 'GROWTH' | 'ENTERPRISE';

export interface Plan {
  tier:         PlanTier;
  name:         string;
  priceUsd:     number;
  /** Display label for the monthly call allowance. */
  calls:        string;
  /** Display label for the per-minute rate limit. */
  rateLimit:    string;
  features:     string[];
  recommended:  boolean;
  /** Marketing CTA label + link. */
  cta:          string;
  ctaHref:      string;
  /** Paid tiers only — drives the dashboard upgrade checkout. */
  stripeEnvKey?: StripeEnvKey;
}

const SIGN_UP = 'https://app.progue.ai/sign-up';

export const PLANS: Plan[] = [
  {
    tier:        'FREE',
    name:        'Free',
    priceUsd:    0,
    calls:       '1,000 calls / mo',
    rateLimit:   '5 req / min',
    features: [
      'All 9 modules',
      'Full audit trail',
      'Community support',
      'No credit card required',
    ],
    recommended: false,
    cta:         'Get started free',
    ctaHref:     SIGN_UP,
  },
  {
    tier:        'STARTER',
    name:        'Starter',
    priceUsd:    149,
    calls:       '10,000 calls / mo',
    rateLimit:   '10 req / min',
    features: [
      'All 9 modules',
      'Full audit trail',
      'Email support',
      'Clerk-based auth',
    ],
    recommended: false,
    cta:         'Get API key',
    ctaHref:     SIGN_UP,
    stripeEnvKey: 'STARTER',
  },
  {
    tier:        'GROWTH',
    name:        'Growth',
    priceUsd:    599,
    calls:       '100,000 calls / mo',
    rateLimit:   '60 req / min',
    features: [
      'All 9 modules',
      'Full audit trail',
      'Priority email support',
      'Usage analytics dashboard',
      'Clerk-based auth',
    ],
    recommended: true,
    cta:         'Get API key',
    ctaHref:     SIGN_UP,
    stripeEnvKey: 'GROWTH',
  },
  {
    tier:        'ENTERPRISE',
    name:        'Enterprise',
    priceUsd:    1999,
    calls:       'Unlimited',
    rateLimit:   '300 req / min',
    features: [
      'All 9 modules',
      'Full audit trail',
      'Dedicated support',
      'Custom guardrail rules',
      'SLA guarantee',
      'Custom contract',
    ],
    recommended: false,
    cta:         'Contact us',
    ctaHref:     'mailto:hello@progue.ai',
    stripeEnvKey: 'ENTERPRISE',
  },
];
