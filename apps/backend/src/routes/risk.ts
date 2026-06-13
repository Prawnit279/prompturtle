import { randomUUID } from 'crypto';

import { TenantTier } from '@prompturtle/shared';
import { Router, type Request, type Response } from 'express';

import { prisma } from '../lib/db.js';
import { getServer } from '../mcp/registry.js';
import type { ToolCallContext } from '../mcp/types.js';

const router = Router();

/** POST /api/risk/score — cross-module shipment risk score */
router.post('/score', async (req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;
  const userId = res.locals.userId as string;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tier: true },
  });

  const ctx: ToolCallContext = {
    tenantId,
    userId,
    tier: (tenant?.tier as unknown as TenantTier) ?? TenantTier.STARTER,
    mcpServer: 'risk-scorer',
    requestId: randomUUID(),
  };

  const server = getServer('risk-scorer');
  const result = await server.call('score_shipment', req.body, ctx);

  res.json(result.data);
});

export default router;
