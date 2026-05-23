import { Router, type NextFunction, type Request, type Response } from 'express';

import { prisma } from '../lib/db.js';
import logger from '../lib/logger.js';
import { stripe } from '../lib/stripe.js';
import { TenantTier, TIER_LIMITS } from '@prompturtle/shared';

const router = Router();

/** GET /api/billing/status — tenant tier, subscription state, and month-to-date call count */
router.get('/status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = res.locals.tenantId as string;

    const tenant = await prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: {
        tier:                  true,
        subscription_status:   true,
        stripe_customer_id:    true,
        stripe_price_id:       true,
      },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    // Count tool calls in the current calendar month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const callsThisMonth = await prisma.toolCall.count({
      where: { tenant_id: tenantId, created_at: { gte: startOfMonth } },
    });

    const tier       = tenant.tier as TenantTier;
    const callLimit  = TIER_LIMITS[tier]?.callsPerMonth ?? 1_000;

    res.json({
      tier,
      subscriptionStatus: tenant.subscription_status ?? 'inactive',
      stripeCustomerId:   tenant.stripe_customer_id ?? null,
      stripePriceId:      tenant.stripe_price_id    ?? null,
      callsThisMonth,
      callLimit,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/billing/checkout — create a Stripe Checkout Session for a new subscription */
router.post('/checkout', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = res.locals.tenantId as string;
    const { priceId } = req.body as { priceId?: string };

    if (!priceId || typeof priceId !== 'string' || priceId.trim().length === 0) {
      res.status(400).json({ error: 'priceId is required' });
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { stripe_customer_id: true, name: true },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    // Reuse existing customer or create one
    let customerId = tenant.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name:     tenant.name,
        metadata: { tenantId },
      });
      customerId = customer.id;
      await prisma.tenant.update({
        where: { id: tenantId },
        data:  { stripe_customer_id: customerId },
      });
      logger.info({ tenantId, customerId }, 'billing.customer_created');
    }

    const session = await stripe.checkout.sessions.create({
      mode:       'subscription',
      customer:   customerId,
      line_items: [{ price: priceId.trim(), quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard/billing?success=true`,
      cancel_url:  `${process.env.FRONTEND_URL}/dashboard/billing?canceled=true`,
      metadata:    { tenantId },
    });

    logger.info({ tenantId, sessionId: session.id }, 'billing.checkout_created');
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

/** POST /api/billing/portal — create a Stripe Customer Portal session */
router.post('/portal', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = res.locals.tenantId as string;

    const tenant = await prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { stripe_customer_id: true },
    });

    if (!tenant?.stripe_customer_id) {
      res.status(400).json({ error: 'No active subscription found' });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   tenant.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard/billing`,
    });

    logger.info({ tenantId }, 'billing.portal_created');
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

export default router;
