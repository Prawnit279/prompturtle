import express, { type Request, type Response } from 'express';
import type Stripe from 'stripe';

import { TenantTier, TIER_LIMITS } from '@prompturtle/shared';

import { prisma } from '../lib/db.js';
import { sendBillingConfirmationEmail } from '../lib/email.js';
import logger from '../lib/logger.js';
import { stripe } from '../lib/stripe.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe
// No auth middleware — security is Stripe signature verification only.
// express.raw() is mounted in app.ts BEFORE express.json() for this route.
// ---------------------------------------------------------------------------
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET ?? '',
    );
  } catch (err) {
    logger.warn({ err }, 'webhook.signature_failed');
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  // Idempotency guard — check BEFORE processing
  const alreadyProcessed = await prisma.processedWebhook.findUnique({
    where: { stripe_event_id: event.id },
  });

  if (alreadyProcessed) {
    logger.info({ eventId: event.id }, 'webhook.duplicate_skipped');
    res.status(200).json({ received: true });
    return;
  }

  // Process the event — do NOT insert ProcessedWebhook on failure so Stripe retries
  try {
    await handleEvent(event);
  } catch (err) {
    logger.error({ err, eventId: event.id, eventType: event.type }, 'webhook.handler_failed');
    res.status(500).json({ error: 'Webhook handler failed' });
    return;
  }

  // Insert AFTER successful processing (insert-after-process pattern)
  await prisma.processedWebhook.create({
    data: { stripe_event_id: event.id, event_type: event.type },
  });

  logger.info({ eventId: event.id, eventType: event.type }, 'webhook.processed');
  res.status(200).json({ received: true });
});

// ---------------------------------------------------------------------------
// Event dispatcher
// ---------------------------------------------------------------------------
async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    default:
      logger.info({ eventType: event.type }, 'webhook.event_ignored');
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const tenantId = session.metadata?.tenantId;
  if (!tenantId) {
    throw new Error(`checkout.session.completed missing tenantId in metadata: ${session.id}`);
  }

  // priceId is not in session metadata — will be set correctly by subscription.created
  const priceId = session.metadata?.priceId ?? null;
  const tier    = mapPriceIdToTier(priceId ?? '');

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      stripe_subscription_id: session.subscription as string,
      subscription_status:    'active',
      stripe_price_id:        priceId,
      tier,
    },
  });

  // Send billing confirmation — non-fatal if it fails
  try {
    const tenantRecord = await prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { email: true, name: true },
    });
    if (tenantRecord?.email) {
      await sendBillingConfirmationEmail({
        to:         tenantRecord.email,
        tenantName: tenantRecord.name,
        tier,
        callLimit:  TIER_LIMITS[tier]?.callsPerMonth ?? 1_000,
      });
    }
  } catch (err) {
    logger.error({ err, tenantId }, 'webhook.billing_email_failed');
  }

  logger.info({ tenantId, tier }, 'webhook.checkout_completed');
}

async function handleSubscriptionUpsert(subscription: Stripe.Subscription): Promise<void> {
  const tenantId = subscription.metadata?.tenantId;
  if (!tenantId) {
    // Subscription created before metadata was set — skip silently
    logger.warn({ subscriptionId: subscription.id }, 'webhook.subscription_missing_tenant');
    return;
  }

  const priceId = subscription.items.data[0]?.price.id ?? null;
  const tier    = mapPriceIdToTier(priceId ?? '');

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      stripe_subscription_id: subscription.id,
      subscription_status:    subscription.status,
      stripe_price_id:        priceId,
      tier,
    },
  });

  logger.info({ tenantId, status: subscription.status, tier }, 'webhook.subscription_upserted');
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const tenantId = subscription.metadata?.tenantId;
  if (!tenantId) {
    logger.warn({ subscriptionId: subscription.id }, 'webhook.deleted_missing_tenant');
    return;
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      subscription_status:    'canceled',
      stripe_price_id:        null,
      stripe_subscription_id: null,
      tier:                   TenantTier.STARTER,
    },
  });

  logger.info({ tenantId }, 'webhook.subscription_deleted');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapPriceIdToTier(priceId: string): TenantTier {
  const map: Record<string, TenantTier> = {
    [process.env.STRIPE_PRICE_STARTER    ?? '']: TenantTier.STARTER,
    [process.env.STRIPE_PRICE_GROWTH     ?? '']: TenantTier.GROWTH,
    [process.env.STRIPE_PRICE_ENTERPRISE ?? '']: TenantTier.ENTERPRISE,
  };
  return map[priceId] ?? TenantTier.STARTER;
}

export default router;
