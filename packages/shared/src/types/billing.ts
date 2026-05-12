import { TenantTier } from './tenant';

export interface BillingTier {
  tier: TenantTier;
  name: string;
  pricePerMonth: number;
  description: string;
}

export const BILLING_TIERS: readonly BillingTier[] = [
  {
    tier: TenantTier.STARTER,
    name: 'Starter',
    pricePerMonth: 149,
    description: 'Up to 10 calls/min and 10,000 calls/month.',
  },
  {
    tier: TenantTier.GROWTH,
    name: 'Growth',
    pricePerMonth: 599,
    description: 'Up to 100 calls/min and 100,000 calls/month.',
  },
  {
    tier: TenantTier.ENTERPRISE,
    name: 'Enterprise',
    pricePerMonth: 1999,
    description: 'Unlimited calls per minute and per month.',
  },
] as const;

export interface UsageRecord {
  tenantId: string;
  /** Billing period in YYYY-MM format. */
  period: string;
  callsUsed: number;
  tier: TenantTier;
  /** Calls beyond the tier monthly limit; 0 when within limit. */
  overageCalls: number;
  /** Calculated overage cost in USD; 0 when within limit. */
  overageCostUsd: number;
}
