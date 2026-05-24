import express, { type Request, type Response } from 'express';
import { Webhook } from 'svix';

import logger from '../lib/logger.js';
import { sendWelcomeEmail } from '../lib/email.js';

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

  if (event.type === 'organization.created' || event.type === 'user.created') {
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
        });
      }
    } catch (err) {
      logger.error({ err, eventType: event.type }, 'clerk-webhook.welcome_email_failed');
    }
  }

  res.status(200).json({ received: true });
});

export default router;
