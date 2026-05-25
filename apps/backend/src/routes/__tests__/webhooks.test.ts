/**
 * Integration tests for POST /api/webhooks/stripe.
 * Stripe and Prisma are fully mocked — no real API calls or DB writes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type Stripe from 'stripe';

// ---- Mocks (must be declared before app import) ----

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock('../../lib/cost-tracker.js', () => ({
  trackedCall: vi.fn().mockImplementation((_o: unknown, fn: () => unknown) => fn()),
  TierLimitExceededError: class TierLimitExceededError extends Error {},
}));

vi.mock('../../lib/logger.js', () => ({
  default: {
    info:  vi.fn(),
    error: vi.fn(),
    warn:  vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

vi.mock('../../guardrails/GuardrailEngine.js', () => ({
  guardrailEngine: { enforce: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../guardrails/rules/InputSchemaRule.js', () => ({
  InputSchemaRule:    class InputSchemaRule { check = vi.fn().mockResolvedValue(null); },
  registerToolSchema: vi.fn(),
}));

vi.mock('../../data/hts-ingest.js', () => ({
  searchHtsCodes: vi.fn().mockResolvedValue([]),
}));

// Mock Stripe — constructEvent and webhooks
vi.mock('../../lib/stripe.js', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    customers:     { create: vi.fn() },
    checkout:      { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
  },
}));

// Mock Clerk
vi.mock('@clerk/clerk-sdk-node', () => ({
  createClerkClient: vi.fn(() => ({
    verifyToken: vi.fn().mockImplementation((token: string) => {
      if (token === 'test-token-starter') {
        return Promise.resolve({ sub: 'user-test', org_id: 'tenant-test' });
      }
      return Promise.reject(new Error('Invalid token'));
    }),
  })),
}));

// Mock Prisma
vi.mock('../../lib/db.js', () => ({
  prisma: {
    processedWebhook: {
      findUnique: vi.fn().mockResolvedValue(null),   // not yet processed by default
      create:     vi.fn().mockResolvedValue({}),
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue(null),
      update:     vi.fn().mockResolvedValue({}),
    },
    apiKey:   { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    toolCall: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
  },
  db: {},
}));

// Import after mocks
import { prisma } from '../../lib/db.js';
import { stripe } from '../../lib/stripe.js';
import app from '../../app.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockWebhook = (prisma.processedWebhook as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTenant  = (prisma.tenant           as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStripe  = (stripe                  as any);

// Helpers to build mock Stripe events
function makeCheckoutEvent(tenantId: string | null = 'tenant-abc'): Stripe.Event {
  return {
    id:   'evt_checkout_001',
    type: 'checkout.session.completed',
    data: {
      object: {
        id:           'cs_test_001',
        subscription: 'sub_test_001',
        metadata:     tenantId ? { tenantId } : {},
      } as unknown as Stripe.Checkout.Session,
    },
  } as Stripe.Event;
}

function makeSubscriptionEvent(
  type: 'customer.subscription.created' | 'customer.subscription.updated' | 'customer.subscription.deleted',
  tenantId: string | null = 'tenant-abc',
): Stripe.Event {
  return {
    id:   `evt_sub_${type}`,
    type,
    data: {
      object: {
        id:       'sub_test_001',
        status:   type === 'customer.subscription.deleted' ? 'canceled' : 'active',
        metadata: tenantId ? { tenantId } : {},
        items:    { data: [{ price: { id: 'price_starter' } }] },
      } as unknown as Stripe.Subscription,
    },
  } as Stripe.Event;
}

function makeUnknownEvent(): Stripe.Event {
  return {
    id: 'evt_unknown_001', type: 'invoice.paid',
    data: { object: {} },
  } as unknown as Stripe.Event;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWebhook.findUnique.mockResolvedValue(null);
  mockWebhook.create.mockResolvedValue({});
  mockTenant.update.mockResolvedValue({});
  mockStripe.webhooks.constructEvent.mockReturnValue(makeCheckoutEvent());
});

// ===========================================================================
describe('POST /api/webhooks/stripe — signature verification', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send('{}');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/stripe-signature/);
  });

  it('returns 400 when constructEvent throws (bad signature)', async () => {
    mockStripe.webhooks.constructEvent.mockImplementationOnce(() => {
      throw new Error('No signatures found matching the expected signature');
    });
    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'bad-sig')
      .send('{}');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/signature/i);
  });
});

// ===========================================================================
describe('POST /api/webhooks/stripe — idempotency', () => {
  it('returns 200 without re-processing when event already in ProcessedWebhook table', async () => {
    mockWebhook.findUnique.mockResolvedValueOnce({ stripe_event_id: 'evt_checkout_001' });

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-sig')
      .send('{}');

    expect(res.status).toBe(200);
    // Handler should NOT have run — tenant.update not called
    expect(mockTenant.update).not.toHaveBeenCalled();
    expect(mockWebhook.create).not.toHaveBeenCalled();
  });

  it('inserts ProcessedWebhook record after successful processing', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValueOnce(makeCheckoutEvent('tenant-abc'));

    await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-sig')
      .send('{}');

    expect(mockWebhook.create).toHaveBeenCalledWith({
      data: { stripe_event_id: 'evt_checkout_001', event_type: 'checkout.session.completed' },
    });
  });

  it('does NOT insert ProcessedWebhook when handler throws (Stripe will retry)', async () => {
    // Missing tenantId causes handleCheckoutCompleted to throw
    mockStripe.webhooks.constructEvent.mockReturnValueOnce(makeCheckoutEvent(null));

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-sig')
      .send('{}');

    expect(res.status).toBe(500);
    expect(mockWebhook.create).not.toHaveBeenCalled();
  });
});

// ===========================================================================
describe('POST /api/webhooks/stripe — event handling', () => {
  it('checkout.session.completed updates tenant subscriptionStatus and tier', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValueOnce(makeCheckoutEvent('tenant-abc'));

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-sig')
      .send('{}');

    expect(res.status).toBe(200);
    expect(mockTenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant-abc' },
        data:  expect.objectContaining({
          stripe_subscription_id: 'sub_test_001',
          subscription_status:    'active',
        }),
      }),
    );
  });

  it('checkout.session.completed with missing tenantId returns 500', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValueOnce(makeCheckoutEvent(null));

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-sig')
      .send('{}');

    expect(res.status).toBe(500);
  });

  it('customer.subscription.updated updates tier and status', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValueOnce(
      makeSubscriptionEvent('customer.subscription.updated', 'tenant-abc'),
    );

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-sig')
      .send('{}');

    expect(res.status).toBe(200);
    expect(mockTenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tenant-abc' },
        data:  expect.objectContaining({ subscription_status: 'active' }),
      }),
    );
  });

  it('customer.subscription.deleted sets tier STARTER and clears subscription fields', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValueOnce(
      makeSubscriptionEvent('customer.subscription.deleted', 'tenant-abc'),
    );

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-sig')
      .send('{}');

    expect(res.status).toBe(200);
    expect(mockTenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscription_status:    'canceled',
          stripe_price_id:        null,
          stripe_subscription_id: null,
          tier:                   'STARTER',
        }),
      }),
    );
  });

  it('unknown event type returns 200 and is ignored gracefully', async () => {
    mockStripe.webhooks.constructEvent.mockReturnValueOnce(makeUnknownEvent());

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'valid-sig')
      .send('{}');

    expect(res.status).toBe(200);
    expect(mockTenant.update).not.toHaveBeenCalled();
    // ProcessedWebhook IS inserted — event was received and ignored intentionally
    expect(mockWebhook.create).toHaveBeenCalled();
  });
});
