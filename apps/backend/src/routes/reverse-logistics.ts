import { randomUUID } from 'crypto';

import { TenantTier } from '@prompturtle/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { prisma } from '../lib/db.js';
import { getServer } from '../mcp/registry.js';
import type { ToolCallContext } from '../mcp/types.js';

const router = Router();
const MCP_SERVER = 'reverse-logistics';

/** Build a ToolCallContext from the authenticated request. */
async function buildContext(res: Response): Promise<ToolCallContext> {
  const tenantId = res.locals.tenantId as string;
  const userId = res.locals.userId as string;

  const tenant = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { tier: true },
  });

  return {
    tenantId,
    userId,
    tier: (tenant?.tier as unknown as TenantTier) ?? TenantTier.FREE,
    mcpServer: MCP_SERVER,
    requestId: randomUUID(),
  };
}

async function runTool(toolName: string, input: unknown, res: Response): Promise<void> {
  const ctx = await buildContext(res);
  const server = getServer(MCP_SERVER);
  const result = await server.call(toolName, input, ctx);
  res.json(result.data);
}

/** POST /api/reverse-logistics/returns — create a return (RMA + BOL + approval). */
router.post('/returns', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await runTool('create_return', req.body, res);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'invalid_return_input', details: err.flatten() });
      return;
    }
    next(err);
  }
});

/** GET /api/reverse-logistics/returns/:rma — fetch a return by RMA number. */
router.get('/returns/:rma', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await runTool('get_return_status', { rmaNumber: req.params.rma }, res);
  } catch (err) {
    next(err);
  }
});

/** POST /api/reverse-logistics/validate — eligibility check (no persistence). */
router.post('/validate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await runTool('validate_return_eligibility', req.body, res);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'invalid_return_input', details: err.flatten() });
      return;
    }
    next(err);
  }
});

/** POST /api/reverse-logistics/route — return carrier options. */
router.post('/route', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await runTool('route_return', req.body, res);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'invalid_return_input', details: err.flatten() });
      return;
    }
    next(err);
  }
});

/** PATCH /api/reverse-logistics/returns/:rma/cancel — cancel a return. */
router.patch('/returns/:rma/cancel', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await runTool('cancel_return', { rmaNumber: req.params.rma }, res);
  } catch (err) {
    next(err);
  }
});

export default router;
