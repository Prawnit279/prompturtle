// TenantTier uses a string enum (per spec).
// Note: existing PromptTier in src/types.ts uses a union type — intentional divergence.

export enum TenantTier {
  STARTER = 'STARTER',
  GROWTH = 'GROWTH',
  ENTERPRISE = 'ENTERPRISE',
}

export interface TierLimit {
  callsPerMinute: number;
  callsPerMonth: number;
}

export const TIER_LIMITS: Record<TenantTier, TierLimit> = {
  [TenantTier.STARTER]: { callsPerMinute: 10, callsPerMonth: 10_000 },
  [TenantTier.GROWTH]: { callsPerMinute: 100, callsPerMonth: 100_000 },
  [TenantTier.ENTERPRISE]: { callsPerMinute: Infinity, callsPerMonth: Infinity },
};

export interface Tenant {
  id: string;
  name: string;
  tier: TenantTier;
  clerkOrgId?: string;
  createdAt: string;
  updatedAt?: string;
}
