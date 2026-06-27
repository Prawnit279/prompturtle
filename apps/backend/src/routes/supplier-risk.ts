import { randomUUID } from 'crypto';

import { TenantTier } from '@prompturtle/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { prisma } from '../lib/db.js';
import { getServer } from '../mcp/registry.js';
import type { ToolCallContext } from '../mcp/types.js';

const router = Router();

/** POST /api/supplier-risk/score — deterministic supplier risk score */
router.post('/score', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = res.locals.tenantId as string;
    const userId = res.locals.userId as string;

    const tenant = await prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { tier: true },
    });

    const ctx: ToolCallContext = {
      tenantId,
      userId,
      tier: (tenant?.tier as unknown as TenantTier) ?? TenantTier.FREE,
      mcpServer: 'supplier-risk',
      requestId: randomUUID(),
    };

    const server = getServer('supplier-risk');
    const result = await server.call('score_supplier', req.body, ctx);

    res.json(result.data);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'invalid_supplier_input', details: err.flatten() });
      return;
    }
    next(err);
  }
});

export default router;
