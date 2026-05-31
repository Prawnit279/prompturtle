import type { Decimal } from '@prisma/client/runtime/library';

import { Router, type Request, type Response } from 'express';

import { prisma } from '../lib/db.js';

const router = Router();

/** GET /api/logs — paginated tool call log, optionally filtered by MCP server */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;
  const page     = Math.max(1, parseInt(req.query['page']   as string) || 1);
  const limit    = Math.min(100, parseInt(req.query['limit'] as string) || 25);
  const server   = req.query['server'] as string | undefined;

  const where = {
    tenant_id: tenantId,
    ...(server ? { mcp_server: server } : {}),
  };

  const [total, calls] = await Promise.all([
    prisma.toolCall.count({ where }),
    prisma.toolCall.findMany({
      where,
      select: {
        id:            true,
        mcp_server:    true,
        tool_name:     true,
        model_used:    true,
        input_tokens:  true,
        output_tokens: true,
        cost_usd:      true,
        latency_ms:    true,
        success:       true,
        created_at:    true,
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  type ToolCallSelectRow = { id: string; mcp_server: string; tool_name: string; model_used: string; input_tokens: number; output_tokens: number; cost_usd: Decimal; latency_ms: number; success: boolean; created_at: Date };
  res.json({
    calls: calls.map((c: ToolCallSelectRow) => ({
      id:           c.id,
      mcpServer:    c.mcp_server,
      toolName:     c.tool_name,
      model:        c.model_used,
      inputTokens:  c.input_tokens,
      outputTokens: c.output_tokens,
      costUsd:      Number(c.cost_usd),
      durationMs:   c.latency_ms,
      // ToolCall uses boolean success; map to status string for frontend
      status:       c.success ? 'SUCCESS' : 'ERROR',
      createdAt:    c.created_at,
    })),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
});

export default router;
