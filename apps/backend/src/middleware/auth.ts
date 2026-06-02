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
    // org_id is present when the user has an active organization session
    if (payload.org_id) {
      res.locals.tenantId = payload.org_id;
    }

    next();
  } catch (err) {
    logger.warn({ err }, 'JWT verification failed');
    res.status(401).json({ error: 'invalid_token' });
  }
}
