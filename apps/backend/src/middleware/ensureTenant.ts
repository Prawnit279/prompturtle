import type { NextFunction, Request, Response } from 'express';

import { prisma } from '../lib/db.js';
import logger from '../lib/logger.js';
import { TenantTier } from '@prompturtle/shared';

/**
 * In-memory cache of tenant ids known to exist in the DB.
 * Prevents an upsert on every authenticated request — we only write once
 * per tenant per server lifetime. Cleared naturally on redeploy/restart,
 * which simply triggers one harmless re-upsert.
 */
const knownTenants = new Set<string>();

/**
 * Self-healing tenant provisioning.
 *
 * The Clerk `organization.created` webhook is the primary path for creating
 * Tenant rows, but it can miss orgs (webhook not yet configured, created
 * during testing, replayed envs, etc.). Without a Tenant row, the first
 * write (e.g. POST /api/keys) fails on the foreign key.
 *
 * This middleware guarantees the active org always has a backing Tenant row.
 * Runs after requireTenant (tenantId guaranteed present) and uses the raw
 * prisma client (no RLS, no UUID validation) so Clerk org_ ids are accepted.
 */
export async function ensureTenant(_req: Request, res: Response, next: NextFunction): Promise<void> {
  const tenantId = res.locals.tenantId as string;

  if (knownTenants.has(tenantId)) {
    next();
    return;
  }

  try {
    await prisma.tenant.upsert({
      where:  { id: tenantId },
      update: {}, // already exists — no-op
      create: {
        id:   tenantId,
        name: 'Organization',
        tier: TenantTier.FREE,
      },
    });
    knownTenants.add(tenantId);
    next();
  } catch (err) {
    logger.error({ err, tenantId }, 'ensure-tenant.upsert_failed');
    res.status(500).json({ error: 'tenant_provisioning_failed' });
  }
}
