/**
 * Integration tests for /api/billing routes.
 * Stripe is fully mocked — no real API calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

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
  InputSchemaRule:     class InputSchemaRule { check = vi.fn().mockResolvedValue(null); },
  registerToolSchema: vi.fn(),
}));

vi.mock('../../data/hts-ingest.js', () => ({
  searchHtsCodes: vi.fn().mockResolvedValue([]),
}));

// Mock Stripe — no real API calls
vi.mock('../../lib/stripe.js', () => ({
  stripe: {
    customers: {
      create: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
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
    tenant: {
      findUnique: vi.fn(),
      update:     vi.fn().mockResolvedValue({}),
      upsert:     vi.fn().mockResolvedValue({ id: 'tenant-test', name: 'Organization', tier: 'STARTER' }),
    },
    toolCall: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
  db: {},
}));

// Import after mocks
import { prisma } from '../../lib/db.js';
import { stripe } from '../../lib/stripe.js';
import app from '../../app.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTenant   = (prisma.tenant   as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockToolCall = (prisma.toolCall as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStripe   = stripe as any;

const AUTH = { Authorization: 'Bearer test-token-starter' };

const SAMPLE_TENANT_NO_STRIPE = {
  tier:                  'STARTER',
  subscription_status:   'inactive',
  stripe_customer_id:    null,
  stripe_price_id:       null,
  name:                  'Acme Corp',
};

const SAMPLE_TENANT_WITH_STRIPE = {
  ...SAMPLE_TENANT_NO_STRIPE,
  stripe_customer_id: 'cus_test_existing',
  stripe_price_id:    'price_starter',
  subscription_status: 'active',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTenant.findUnique.mockResolvedValue(SAMPLE_TENANT_NO_STRIPE);
  mockTenant.update.mockResolvedValue({});
  mockToolCall.count.mockResolvedValue(42);

  mockStripe.customers.create.mockResolvedValue({ id: 'cus_test_new' });
  mockStripe.checkout.sessions.create.mockResolvedValue({
    id:  'cs_test_session',
    url: 'https://checkout.stripe.com/pay/cs_test_session',
  });
  mockStripe.billingPortal.sessions.create.mockResolvedValue({
    url: 'https://billing.stripe.com/session/test',
  });
});

// ===========================================================================
describe('GET /api/billing/status', () => {
  it('returns billing data for authenticated tenant', async () => {
    const res = await request(app).get('/api/billing/status').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('STARTER');
    expect(res.body.subscriptionStatus).toBe('inactive');
    expect(typeof res.body.callsThisMonth).toBe('number');
    expect(typeof res.body.callLimit).toBe('number');
  });

  it('includes call limit matching the tier', async () => {
    const res = await request(app).get('/api/billing/status').set(AUTH);
    expect(res.body.callLimit).toBe(1_000); // STARTER limit
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/billing/status');
    expect(res.status).toBe(401);
  });

  it('returns 404 when tenant record not found', async () => {
    mockTenant.findUnique.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/billing/status').set(AUTH);
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
describe('POST /api/billing/checkout', () => {
  it('creates Stripe customer when none exists, then creates session', async () => {
    const res = await request(app)
      .post('/api/billing/checkout')
      .set(AUTH)
      .send({ priceId: 'price_starter' });

    expect(res.status).toBe(200);
    expect(mockStripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ tenantId: 'tenant-test' }) }),
    );
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalled();
    expect(res.body.url).toMatch(/checkout\.stripe\.com/);
  });

  it('reuses existing stripeCustomerId without creating a new customer', async () => {
    mockTenant.findUnique.mockResolvedValueOnce(SAMPLE_TENANT_WITH_STRIPE);

    const res = await request(app)
      .post('/api/billing/checkout')
      .set(AUTH)
      .send({ priceId: 'price_growth' });

    expect(res.status).toBe(200);
    expect(mockStripe.customers.create).not.toHaveBeenCalled();
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_test_existing' }),
    );
  });

  it('returns { url } from Stripe session', async () => {
    const res = await request(app)
      .post('/api/billing/checkout')
      .set(AUTH)
      .send({ priceId: 'price_starter' });

    expect(res.body).toHaveProperty('url');
    expect(typeof res.body.url).toBe('string');
  });

  it('returns 400 when priceId is missing', async () => {
    const res = await request(app).post('/api/billing/checkout').set(AUTH).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/priceId/);
  });

  it('returns 400 when priceId is empty string', async () => {
    const res = await request(app)
      .post('/api/billing/checkout')
      .set(AUTH)
      .send({ priceId: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/billing/checkout')
      .send({ priceId: 'price_starter' });
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
describe('POST /api/billing/portal', () => {
  it('returns portal URL for tenant with active stripeCustomerId', async () => {
    mockTenant.findUnique.mockResolvedValueOnce(SAMPLE_TENANT_WITH_STRIPE);

    const res = await request(app).post('/api/billing/portal').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/billing\.stripe\.com/);
    expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_test_existing' }),
    );
  });

  it('returns 400 when tenant has no stripeCustomerId', async () => {
    mockTenant.findUnique.mockResolvedValueOnce(SAMPLE_TENANT_NO_STRIPE);

    const res = await request(app).post('/api/billing/portal').set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No active subscription/);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/billing/portal');
    expect(res.status).toBe(401);
  });
});
