// TenantTier uses a string enum (per spec).
// Note: existing PromptTier in src/types.ts uses a union type — intentional divergence.

export enum TenantTier {
  FREE = 'FREE',
  STARTER = 'STARTER',
  GROWTH = 'GROWTH',
  ENTERPRISE = 'ENTERPRISE',
}

export interface TierLimit {
  callsPerMinute: number;
  /** Monthly call cap. `0` means unlimited (Enterprise). */
  callsPerMonth: number;
  /** Monthly subscription price in USD. `0` for the free tier. */
  priceUsd: number;
  modelsAllowed: readonly string[];
}

export const TIER_LIMITS: Record<TenantTier, TierLimit> = {
  [TenantTier.FREE]: {
    callsPerMinute: 5,
    callsPerMonth: 1_000,
    priceUsd: 0,
    modelsAllowed: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'] as const,
  },
  [TenantTier.STARTER]: {
    callsPerMinute: 10,
    callsPerMonth: 10_000,
    priceUsd: 149,
    modelsAllowed: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'] as const,
  },
  [TenantTier.GROWTH]: {
    callsPerMinute: 60,
    callsPerMonth: 100_000,
    priceUsd: 599,
    modelsAllowed: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'] as const,
  },
  [TenantTier.ENTERPRISE]: {
    callsPerMinute: 300,
    callsPerMonth: 0, // unlimited
    priceUsd: 1999,
    modelsAllowed: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'] as const,
  },
} as const satisfies Record<
  TenantTier,
  { callsPerMinute: number; callsPerMonth: number; priceUsd: number; modelsAllowed: readonly string[] }
>;

export interface Tenant {
  id: string;
  name: string;
  tier: TenantTier;
  clerkOrgId?: string;
  createdAt: string;
  updatedAt?: string;
}
