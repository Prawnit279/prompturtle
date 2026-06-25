/**
 * Per-tenant guardrail configuration API (Week 4).
 * Mounted on the protected router at /api/guardrails.
 *
 *   GET    /api/guardrails/config  — current config, or defaults with isDefault:true
 *   PATCH  /api/guardrails/config  — partial upsert (only provided fields change)
 *   DELETE /api/guardrails/config  — reset to platform defaults (delete the row)
 *
 * Tenant-scoped via res.locals.tenantId; uses raw prisma (org-id tenant keys).
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import type { GuardrailConfigResult } from '@prompturtle/shared';

import { prisma } from '../lib/db.js';
import { getGuardrailConfig } from '../lib/guardrail-config.js';
import logger from '../lib/logger.js';

const router = Router();

// Unknown fields are stripped by zod (default), satisfying "ignore unknown silently".
const UpdateInput = z.object({
  costThreshold:       z.number().positive().optional(),
  approvedCarriers:    z.array(z.string().min(1)).optional(),
  requireBrokerVerify: z.boolean().optional(),
  autoApproveBelow:    z.number().min(0).optional(),
});

interface ConfigRow {
  id: string;
  tenant_id: string;
  cost_threshold: number;
  approved_carriers: string[];
  require_broker_verify: boolean;
  auto_approve_below: number;
  updated_at: Date;
}

function toResult(row: ConfigRow): GuardrailConfigResult {
  return {
    id:                  row.id,
    tenantId:            row.tenant_id,
    costThreshold:       row.cost_threshold,
    approvedCarriers:    row.approved_carriers,
    requireBrokerVerify: row.require_broker_verify,
    autoApproveBelow:    row.auto_approve_below,
    updatedAt:           row.updated_at.toISOString(),
  };
}

/** GET /api/guardrails/config — current config or defaults (isDefault:true). */
router.get('/config', async (_req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;
  const config = await getGuardrailConfig(tenantId);
  res.json({ ...config, isDefault: config.id === '' });
});

/** PATCH /api/guardrails/config — partial upsert with cross-field validation. */
router.patch('/config', async (req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;

  const parsed = UpdateInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'invalid_config', details: parsed.error.flatten() });
    return;
  }

  // Validate autoApproveBelow < costThreshold against the effective pair
  // (incoming value wins, else the current/stored value).
  const existing = await getGuardrailConfig(tenantId);
  const effCostThreshold = parsed.data.costThreshold ?? existing.costThreshold;
  const effAutoApprove   = parsed.data.autoApproveBelow ?? existing.autoApproveBelow;
  if (effAutoApprove >= effCostThreshold) {
    res.status(422).json({ error: 'autoApproveBelow must be less than costThreshold' });
    return;
  }

  const data: {
    cost_threshold?: number;
    approved_carriers?: string[];
    require_broker_verify?: boolean;
    auto_approve_below?: number;
  } = {};
  if (parsed.data.costThreshold       !== undefined) data.cost_threshold        = parsed.data.costThreshold;
  if (parsed.data.approvedCarriers    !== undefined) data.approved_carriers     = parsed.data.approvedCarriers;
  if (parsed.data.requireBrokerVerify !== undefined) data.require_broker_verify = parsed.data.requireBrokerVerify;
  if (parsed.data.autoApproveBelow    !== undefined) data.auto_approve_below    = parsed.data.autoApproveBelow;

  const row = await prisma.guardrailConfig.upsert({
    where:  { tenant_id: tenantId },
    create: { tenant_id: tenantId, ...data },
    update: data,
  });

  logger.info({ tenantId }, 'guardrail_config.updated');
  res.json(toResult(row));
});

/** DELETE /api/guardrails/config — reset to defaults (idempotent). */
router.delete('/config', async (_req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;
  await prisma.guardrailConfig.deleteMany({ where: { tenant_id: tenantId } });
  logger.info({ tenantId }, 'guardrail_config.reset');
  res.status(204).send();
});

export default router;
