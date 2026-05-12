import type { NextFunction, Request, Response } from 'express';

/**
 * Guards routes that require an active tenant context.
 * Must be applied after the auth middleware.
 *
 * Returns 401 if:
 * - No Authorization header was sent (no userId)
 * - Token was valid but user has no active org (no tenantId)
 */
export function requireTenant(_req: Request, res: Response, next: NextFunction): void {
  if (!res.locals.tenantId) {
    res.status(401).json({ error: 'tenant_required' });
    return;
  }
  next();
}
