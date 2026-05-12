import type { NextFunction, Request, Response } from 'express';

import { runWithTenant } from '../lib/tenantContext';

/**
 * Bridges res.locals (set by auth middleware) into AsyncLocalStorage
 * so Prisma's RLS extension can read tenantId without param drilling.
 *
 * Must be applied AFTER requireTenant (guarantees tenantId is present).
 */
export function withTenantContext(req: Request, res: Response, next: NextFunction): void {
  const { tenantId, userId } = res.locals;

  // requireTenant should have blocked this case, but fail closed defensively
  if (!tenantId) {
    res.status(401).json({ error: 'tenant_required' });
    return;
  }

  const ctx = userId ? { tenantId, userId } : { tenantId };
  runWithTenant(ctx, () => next());
}
