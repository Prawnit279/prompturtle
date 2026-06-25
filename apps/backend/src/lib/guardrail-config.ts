/**
 * Per-tenant guardrail configuration access (Week 4).
 *
 * Reads the tenant's GuardrailConfig row on every call (no caching, by design —
 * caching is a later optimization). Falls back to GUARDRAIL_DEFAULTS when no row
 * exists, so the engine behaves identically to the pre-Week-4 hardcoded version.
 *
 * Uses raw `prisma` (not the RLS `db` client): tenant ids are Clerk org ids
 * (text, not UUID), which the RLS extension rejects — see CLAUDE.md pitfall #11.
 */
import { GUARDRAIL_DEFAULTS, type GuardrailConfigResult } from '@prompturtle/shared';

import { prisma } from './db.js';

/** Fetch a tenant's guardrail config, or the platform defaults if none is set. */
export async function getGuardrailConfig(tenantId: string): Promise<GuardrailConfigResult> {
  const config = await prisma.guardrailConfig.findUnique({ where: { tenant_id: tenantId } });

  if (!config) {
    return { id: '', tenantId, updatedAt: '', ...GUARDRAIL_DEFAULTS };
  }

  return {
    id:                  config.id,
    tenantId:            config.tenant_id,
    costThreshold:       config.cost_threshold,
    approvedCarriers:    config.approved_carriers,
    requireBrokerVerify: config.require_broker_verify,
    autoApproveBelow:    config.auto_approve_below,
    updatedAt:           config.updated_at.toISOString(),
  };
}
