/**
 * Tenant-facing webhook management API (Week 3).
 *
 * Mounted on the protected router at /api/webhooks. Distinct from routes/webhooks.ts,
 * which handles inbound Stripe webhooks at /api/webhooks/stripe (registered earlier
 * in app.ts with a raw body parser).
 *
 *   POST   /api/webhooks               register (returns secret once)
 *   GET    /api/webhooks               list (never returns secret)
 *   PATCH  /api/webhooks/:id           update url/events/description/isActive
 *   DELETE /api/webhooks/:id           soft-delete (is_active=false)
 *   GET    /api/webhooks/:id/deliveries paginated delivery log (20/page)
 *   POST   /api/webhooks/:id/test      send a synthetic test.ping
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import type { WebhookDeliveryRecord, WebhookEventType, WebhookRegistration } from '@prompturtle/shared';

import { prisma } from '../lib/db.js';
import logger from '../lib/logger.js';
import { assertPublicWebhookUrl, UnsafeWebhookUrlError } from '../lib/url-safety.js';
import { generateWebhookSecret, sendTestPing } from '../lib/webhook-service.js';

const router = Router();

const DELIVERIES_PER_PAGE = 20;

// Literal tuple (zod needs string literals) — mirrors SUBSCRIBABLE_WEBHOOK_EVENTS
// in @prompturtle/shared. `test.ping` is intentionally excluded: it is not a
// subscribable event, only a manual verification ping.
const EVENT_VALUES = [
  'approval.approved',
  'approval.rejected',
  'approval.expired',
  'decision.halted',
  'decision.escalated',
  'usage.threshold_reached',
] as const;

const httpsUrl = z.string().url().refine((u) => u.startsWith('https://'), {
  message: 'url must be an https:// URL',
});

const CreateWebhookInput = z.object({
  url:         httpsUrl,
  events:      z.array(z.enum(EVENT_VALUES)).min(1),
  description: z.string().max(500).optional(),
});

const UpdateWebhookInput = z.object({
  url:         httpsUrl.optional(),
  events:      z.array(z.enum(EVENT_VALUES)).min(1).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive:    z.boolean().optional(),
});

// Columns safe to select for list/update responses — never includes `secret`.
const PUBLIC_COLUMNS = {
  id:          true,
  url:         true,
  events:      true,
  description: true,
  is_active:   true,
  created_at:  true,
} as const;

interface PublicWebhookRow {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  is_active: boolean;
  created_at: Date;
}

function toRegistration(w: PublicWebhookRow, secret?: string): WebhookRegistration {
  const reg: WebhookRegistration = {
    id:        w.id,
    url:       w.url,
    events:    w.events as WebhookEventType[],
    isActive:  w.is_active,
    createdAt: w.created_at.toISOString(),
  };
  if (w.description !== null) reg.description = w.description;
  if (secret !== undefined) reg.secret = secret;
  return reg;
}

interface DeliveryRow {
  id: string;
  webhook_id: string;
  event: string;
  status_code: number | null;
  success: boolean;
  attempt_count: number;
  delivered_at: Date | null;
  created_at: Date;
}

function toDeliveryRecord(d: DeliveryRow): WebhookDeliveryRecord {
  const rec: WebhookDeliveryRecord = {
    id:           d.id,
    webhookId:    d.webhook_id,
    event:        d.event as WebhookEventType,
    success:      d.success,
    attemptCount: d.attempt_count,
    createdAt:    d.created_at.toISOString(),
  };
  if (d.status_code !== null) rec.statusCode = d.status_code;
  if (d.delivered_at !== null) rec.deliveredAt = d.delivered_at.toISOString();
  return rec;
}

/** POST /api/webhooks — register an endpoint; secret returned once. */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;

  const parsed = CreateWebhookInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_webhook', details: parsed.error.flatten() });
    return;
  }

  try {
    await assertPublicWebhookUrl(parsed.data.url);
  } catch (err) {
    if (err instanceof UnsafeWebhookUrlError) {
      res.status(400).json({ error: 'unsafe_url', message: err.message });
      return;
    }
    throw err;
  }

  const secret = generateWebhookSecret();
  const webhook = await prisma.webhook.create({
    data: {
      tenant_id:   tenantId,
      url:         parsed.data.url,
      secret,
      events:      parsed.data.events,
      description: parsed.data.description ?? null,
    },
    select: PUBLIC_COLUMNS,
  });

  logger.info({ tenantId, webhookId: webhook.id }, 'webhook.created');
  res.status(201).json({ webhook: toRegistration(webhook, secret) });
});

/** GET /api/webhooks — list the tenant's endpoints (secret excluded). */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;
  const webhooks = await prisma.webhook.findMany({
    where:   { tenant_id: tenantId },
    orderBy: { created_at: 'desc' },
    select:  PUBLIC_COLUMNS,
  });

  // Attach a last-delivery summary per webhook. N+1 by webhook count, which is
  // small per tenant; correct and bounded (one findFirst per endpoint).
  const withLast = await Promise.all(
    webhooks.map(async (w: PublicWebhookRow) => {
      const reg = toRegistration(w);
      const last = await prisma.webhookDelivery.findFirst({
        where:   { webhook_id: w.id },
        orderBy: { created_at: 'desc' },
        select:  { success: true, status_code: true, created_at: true },
      });
      if (!last) return reg;
      return {
        ...reg,
        lastDelivery: {
          success:    last.success,
          statusCode: last.status_code ?? undefined,
          createdAt:  last.created_at.toISOString(),
        },
      };
    }),
  );

  res.json({ webhooks: withLast });
});

/** PATCH /api/webhooks/:id — update fields. */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;
  const id = req.params['id'] as string;

  const existing = await prisma.webhook.findFirst({ where: { id, tenant_id: tenantId }, select: { id: true } });
  if (!existing) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  const parsed = UpdateWebhookInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_webhook', details: parsed.error.flatten() });
    return;
  }

  if (parsed.data.url !== undefined) {
    try {
      await assertPublicWebhookUrl(parsed.data.url);
    } catch (err) {
      if (err instanceof UnsafeWebhookUrlError) {
        res.status(400).json({ error: 'unsafe_url', message: err.message });
        return;
      }
      throw err;
    }
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.url         !== undefined) data['url']         = parsed.data.url;
  if (parsed.data.events      !== undefined) data['events']      = parsed.data.events;
  if (parsed.data.description !== undefined) data['description'] = parsed.data.description;
  if (parsed.data.isActive    !== undefined) data['is_active']   = parsed.data.isActive;

  const updated = await prisma.webhook.update({
    where:  { id: existing.id },
    data,
    select: PUBLIC_COLUMNS,
  });

  logger.info({ tenantId, webhookId: id }, 'webhook.updated');
  res.json({ webhook: toRegistration(updated) });
});

/** DELETE /api/webhooks/:id — soft-delete (deactivate). */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;
  const id = req.params['id'] as string;

  const existing = await prisma.webhook.findFirst({ where: { id, tenant_id: tenantId }, select: { id: true } });
  if (!existing) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  await prisma.webhook.update({ where: { id: existing.id }, data: { is_active: false } });
  logger.info({ tenantId, webhookId: id }, 'webhook.deactivated');
  res.status(204).send();
});

/** GET /api/webhooks/:id/deliveries — paginated delivery log. */
router.get('/:id/deliveries', async (req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;
  const id = req.params['id'] as string;

  const webhook = await prisma.webhook.findFirst({ where: { id, tenant_id: tenantId }, select: { id: true } });
  if (!webhook) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  const page = Math.max(1, Number.parseInt(String(req.query['page'] ?? '1'), 10) || 1);

  const [rows, total] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where:   { webhook_id: webhook.id },
      orderBy: { created_at: 'desc' },
      skip:    (page - 1) * DELIVERIES_PER_PAGE,
      take:    DELIVERIES_PER_PAGE,
      select: {
        id: true, webhook_id: true, event: true, status_code: true,
        success: true, attempt_count: true, delivered_at: true, created_at: true,
      },
    }),
    prisma.webhookDelivery.count({ where: { webhook_id: webhook.id } }),
  ]);

  res.json({
    deliveries: rows.map(toDeliveryRecord),
    total,
    page,
    limit: DELIVERIES_PER_PAGE,
    pages: Math.ceil(total / DELIVERIES_PER_PAGE),
  });
});

/** POST /api/webhooks/:id/test — send a synthetic test.ping to the endpoint. */
router.post('/:id/test', async (req: Request, res: Response): Promise<void> => {
  const tenantId = res.locals.tenantId as string;
  const id = req.params['id'] as string;

  const webhook = await prisma.webhook.findFirst({
    where:  { id, tenant_id: tenantId },
    select: { id: true, url: true, secret: true },
  });
  if (!webhook) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  const result = await sendTestPing(webhook, tenantId);
  logger.info({ tenantId, webhookId: id, success: result.success }, 'webhook.test_ping');
  res.json({ success: result.success, statusCode: result.statusCode });
});

export default router;
