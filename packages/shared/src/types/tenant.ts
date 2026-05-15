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
  modelsAllowed: readonly string[];
}

export const TIER_LIMITS: Record<TenantTier, TierLimit> = {
  [TenantTier.STARTER]: {
    callsPerMinute: 10,
    callsPerMonth: 1_000,
    modelsAllowed: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'] as const,
  },
  [TenantTier.GROWTH]: {
    callsPerMinute: 60,
    callsPerMonth: 10_000,
    modelsAllowed: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'] as const,
  },
  [TenantTier.ENTERPRISE]: {
    callsPerMinute: 300,
    callsPerMonth: 100_000,
    modelsAllowed: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-6'] as const,
  },
} as const satisfies Record<
  TenantTier,
  { callsPerMinute: number; callsPerMonth: number; modelsAllowed: readonly string[] }
>;

export interface Tenant {
  id: string;
  name: string;
  tier: TenantTier;
  clerkOrgId?: string;
  createdAt: string;
  updatedAt?: string;
}
