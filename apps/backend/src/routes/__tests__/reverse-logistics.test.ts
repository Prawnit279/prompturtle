/**
 * Integration tests for the reverse-logistics routes.
 * Supertest against the full Express app with mocked dependencies.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: vi.fn() } })),
}));

vi.mock('../../lib/cost-tracker.js', () => ({
  trackedCall: vi.fn().mockImplementation((_o: unknown, fn: () => unknown) => fn()),
  TierLimitExceededError: class TierLimitExceededError extends Error {},
}));

vi.mock('../../lib/logger.js', () => ({
  default: {
    info: vi.fn(), error: vi.fn(), warn: vi.fn(),
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

vi.mock('../../lib/guardrail-config.js', () => ({
  getGuardrailConfig: vi.fn().mockResolvedValue({
    id: '', tenantId: 'tenant-test', costThreshold: 10000, approvedCarriers: [],
    requireBrokerVerify: true, autoApproveBelow: 0, updatedAt: '',
  }),
}));

vi.mock('../../lib/approval.js', () => ({
  checkAndRequestApproval: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../data/hts-ingest.js', () => ({
  searchHtsCodes: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../lib/stripe.js', () => ({
  stripe: {
    customers:     { create: vi.fn() },
    checkout:      { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
  },
}));

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

vi.mock('../../lib/db.js', () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ tier: 'GROWTH', name: 'Acme Logistics' }),
      upsert:     vi.fn().mockResolvedValue({ id: 'tenant-test', name: 'Acme Logistics', tier: 'GROWTH' }),
    },
    auditEvent: { create: vi.fn().mockResolvedValue({}) },
    returnRequest: {
      count:  vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'ret_1', ...data, created_at: new Date('2026-07-01T00:00:00Z'), updated_at: new Date('2026-07-01T00:00:00Z') })),
      findFirst: vi.fn(),
      update:    vi.fn(),
    },
  },
}));

import app from '../../app.js';

const AUTH = { Authorization: 'Bearer test-token-starter' };

function addr(over: Record<string, unknown> = {}) {
  return { name: 'Acme Returns', street: '1 Main St', city: 'Denver', region: 'CO', postalCode: '80202', country: 'US', ...over };
}

function createBody(over: Record<string, unknown> = {}) {
  return {
    returnReason: 'DAMAGED_IN_TRANSIT',
    items: [{ sku: 'SKU1', description: 'Widget', quantity: 2, unitValue: 50, weight: 3 }],
    declaredValue: 4500,
    urgency: 'standard',
    originAddress: addr(),
    destinationAddress: addr({ name: 'Warehouse' }),
    ...over,
  };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('POST /api/reverse-logistics/returns', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/reverse-logistics/returns').send(createBody());
    expect(res.status).toBe(401);
  });

  it('creates a return and returns the RMA + return BOL', async () => {
    const res = await request(app).post('/api/reverse-logistics/returns').set(AUTH).send(createBody());
    expect(res.status).toBe(200);
    expect(res.body.rmaNumber).toMatch(/^RMA-/);
    expect(res.body.returnBolNumber).toMatch(/^RBOL-/);
    expect(res.body.requiresApproval).toBe(false);
    expect(Array.isArray(res.body.carrierOptions)).toBe(true);
  });
});

describe('POST /api/reverse-logistics/validate', () => {
  it('returns eligibility for a valid body', async () => {
    const res = await request(app)
      .post('/api/reverse-logistics/validate')
      .set(AUTH)
      .send({ returnReason: 'QUALITY_ISSUE', declaredValue: 15000, items: [{ sku: 'A', description: 'x', quantity: 1, unitValue: 10 }] });
    expect(res.status).toBe(200);
    expect(res.body.eligible).toBe(true);
    expect(res.body.requiresApproval).toBe(true);
  });
});
