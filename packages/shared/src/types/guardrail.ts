/**
 * Per-tenant guardrail configuration types (Week 4).
 *
 * Wire/API shapes (camelCase), distinct from the snake_case Prisma model.
 * A tenant with no config row falls back to GUARDRAIL_DEFAULTS, which encode
 * the original hardcoded behavior.
 */

export interface GuardrailConfigInput {
  costThreshold?: number;
  approvedCarriers?: string[];
  requireBrokerVerify?: boolean;
  autoApproveBelow?: number;
}

export interface GuardrailConfigResult {
  id: string;
  tenantId: string;
  costThreshold: number;
  approvedCarriers: string[];
  requireBrokerVerify: boolean;
  autoApproveBelow: number;
  updatedAt: string;
}

/** Canonical defaults — mirror the pre-Week-4 hardcoded behavior. */
export const GUARDRAIL_DEFAULTS = {
  costThreshold: 10000,
  approvedCarriers: [] as string[],
  requireBrokerVerify: true,
  autoApproveBelow: 0,
} as const;
