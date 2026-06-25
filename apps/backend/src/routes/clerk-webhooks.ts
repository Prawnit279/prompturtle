import express, { type Request, type Response } from 'express';
import { Webhook } from 'svix';

import { prisma } from '../lib/db.js';
import logger from '../lib/logger.js';
import { sendWelcomeEmail } from '../lib/email.js';
import { TenantTier } from '@prompturtle/shared';

const router = express.Router();

// ---------------------------------------------------------------------------
// POST /api/webhooks/clerk
// No auth middleware — security is svix signature verification only.
// express.raw() is mounted in app.ts BEFORE express.json() for this route.
// ---------------------------------------------------------------------------
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const svixId        = req.headers['svix-id']        as string | undefined;
  const svixTimestamp = req.headers['svix-timestamp'] as string | undefined;
  const svixSignature = req.headers['svix-signature'] as string | undefined;

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: 'Missing svix headers' });
    return;
  }

  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error('clerk-webhook.secret_missing');
    res.status(500).json({ error: 'Webhook not configured' });
    return;
  }

  let event: { type: string; data: Record<string, unknown> };

  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(req.body as Buffer, {
      'svix-id':        svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: Record<string, unknown> };
  } catch (err) {
    logger.warn({ err }, 'clerk-webhook.signature_failed');
    res.status(400).json({ error: 'Invalid webhook signature' });
    return;
  }

  // ── organization.created ────────────────────────────────────────────────
  // Creates the Tenant row that all other tables FK into.
  // NOTE: Tenant.id is @db.Uuid in the Prisma schema but auth.ts sets
  // res.locals.tenantId = org_id directly. If PostgreSQL rejects the
  // org_xxx format, a migration is needed to change tenants.id to TEXT.
  if (event.type === 'organization.created') {
    const data = event.data;
    const orgId   = data['id']   as string;
    const orgName = data['name'] as string;

    try {
      await prisma.tenant.upsert({
        where:  { id: orgId },
        update: {}, // already exists — no-op
        create: {
          id:   orgId,
          name: orgName || 'Unnamed Organization',
          tier: TenantTier.FREE,
        },
      });
      logger.info({ orgId, orgName }, 'clerk-webhook.tenant_created');
    } catch (err) {
      logger.error({ err, orgId }, 'clerk-webhook.tenant_create_failed');
      // Return 500 so Clerk retries — this is fatal; without the tenant
      // row every subsequent API call will fail with tenant_required.
      res.status(500).json({ error: 'tenant_create_failed' });
      return;
    }
  }

  // ── organization.deleted ─────────────────────────────────────────────────
  // Cascade deletes all child rows (api_keys, tool_calls, etc.).
  if (event.type === 'organization.deleted') {
    const data  = event.data;
    const orgId = data['id'] as string;

    try {
      await prisma.tenant.delete({ where: { id: orgId } });
      logger.info({ orgId }, 'clerk-webhook.tenant_deleted');
    } catch (err) {
      // P2025 = record not found — already gone, treat as success
      const code = (err as { code?: string }).code;
      if (code !== 'P2025') {
        logger.error({ err, orgId }, 'clerk-webhook.tenant_delete_failed');
      }
    }
  }

  // ── user.created ─────────────────────────────────────────────────────────
  if (event.type === 'user.created' || event.type === 'organization.created') {
    // Non-fatal — email failure must not cause Clerk to retry indefinitely
    try {
      const data  = event.data;
      const email = event.type === 'user.created'
        ? (data['email_addresses'] as Array<{ email_address: string }>)?.[0]?.email_address
        : undefined; // org events: email not reliably present — skip

      const name = event.type === 'organization.created'
        ? (data['name'] as string)
        : `${String(data['first_name'] ?? '')} ${String(data['last_name'] ?? '')}`.trim();

      if (email) {
        await sendWelcomeEmail({
          to:         email,
          tenantName: name || 'there',
          apiKey:     '(Create your first API key in the dashboard)',
          tier:       TenantTier.FREE, // new signups start on the free tier
        });
      }
    } catch (err) {
      logger.error({ err, eventType: event.type }, 'clerk-webhook.welcome_email_failed');
    }
  }

  res.status(200).json({ received: true });
});

export default router;
