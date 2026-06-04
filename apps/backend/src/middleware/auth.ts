import { createClerkClient } from '@clerk/clerk-sdk-node';
import type { NextFunction, Request, Response } from 'express';

import logger from '../lib/logger.js';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

/**
 * Verifies the Clerk JWT in the Authorization header.
 *
 * On success: sets res.locals.tenantId (from org_id) and res.locals.userId (from sub).
 * On missing header: calls next() without setting locals (let requireTenant decide).
 * On invalid/expired token: responds 401 immediately.
 *
 * NOTE: tenantId is the Clerk org_id, stored as tenants.id in our DB.
 */
export async function auth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // OPTIONS preflight requests carry no Authorization header; skip auth entirely
  // so CORS can respond with 204 before any auth logic runs.
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = await clerkClient.verifyToken(token);

    res.locals.userId = payload.sub;

    // Resolve the active organization id from the JWT.
    // Clerk v1 session tokens expose a flat `org_id` claim.
    // Clerk v2 session tokens (v: 2) nest org data under `o`: { id, rol, slg }.
    // We support both so tenant resolution works regardless of token version.
    // justification: Clerk SDK v4 types don't model the v2 `o` claim.
    const claims = payload as Record<string, unknown>;
    const flatOrgId = typeof claims.org_id === 'string' ? claims.org_id : undefined;
    const nestedOrg = claims.o as { id?: string } | undefined;
    const orgId = flatOrgId ?? nestedOrg?.id;

    if (orgId) {
      res.locals.tenantId = orgId;
    }

    next();
  } catch (err) {
    logger.warn({ err }, 'JWT verification failed');
    res.status(401).json({ error: 'invalid_token' });
  }
}
