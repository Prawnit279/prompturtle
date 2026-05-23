import { Router, type Request, type Response } from 'express';

import { prisma } from '../lib/db.js';

const router = Router();

/** GET /api/usage — aggregated token + cost usage by MCP server */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;
  const days     = Math.min(90, parseInt(req.query['days'] as string) || 30);
  const since    = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.toolCall.groupBy({
    by:    ['mcp_server'],
    where: { tenant_id: tenantId, created_at: { gte: since } },
    _sum:  { cost_usd: true, input_tokens: true, output_tokens: true },
    _count: { id: true },
  });

  const totalCostUsd = rows.reduce((acc, r) => acc + Number(r._sum.cost_usd ?? 0), 0);
  const totalCalls   = rows.reduce((acc, r) => acc + r._count.id, 0);

  res.json({
    days,
    totalCostUsd,
    totalCalls,
    byServer: rows.map((r) => ({
      server:       r.mcp_server,
      calls:        r._count.id,
      costUsd:      Number(r._sum.cost_usd      ?? 0),
      inputTokens:  r._sum.input_tokens  ?? 0,
      outputTokens: r._sum.output_tokens ?? 0,
    })),
  });
});

export default router;
