import { randomUUID } from 'crypto';

import { TenantTier } from '@prompturtle/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { prisma } from '../lib/db.js';
import { getServer } from '../mcp/registry.js';
import { emissionFactorList } from '../mcp/servers/CarbonTrackingMCP.js';
import type { ToolCallContext } from '../mcp/types.js';

const MCP_SERVER = 'carbon-tracking';

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

/** Invalid input → 422 (per the carbon module spec); everything else → next(). */
function handleError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(422).json({ error: 'invalid_carbon_input', details: err.flatten() });
    return;
  }
  next(err);
}

// ---------------------------------------------------------------------------
// Public router — GET /api/carbon/factors is an unauthenticated reference query.
// Mounted before the protected router so it never hits requireTenant.
// ---------------------------------------------------------------------------
export const carbonPublicRouter = Router();

carbonPublicRouter.get('/factors', (_req: Request, res: Response): void => {
  res.json({ factors: emissionFactorList() });
});

// ---------------------------------------------------------------------------
// Protected router — calculate / compare / report (auth + tenant context).
// ---------------------------------------------------------------------------
const router = Router();

/** POST /api/carbon/calculate — CO2e for a single shipment. */
router.post('/calculate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await runTool('calculate_footprint', req.body, res);
  } catch (err) {
    handleError(err, res, next);
  }
});

/** POST /api/carbon/compare — compare transport modes by CO2e. */
router.post('/compare', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await runTool('compare_routes', req.body, res);
  } catch (err) {
    handleError(err, res, next);
  }
});

/** POST /api/carbon/report — aggregate footprints over a date range. */
router.post('/report', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await runTool('generate_report', req.body, res);
  } catch (err) {
    handleError(err, res, next);
  }
});

export default router;
