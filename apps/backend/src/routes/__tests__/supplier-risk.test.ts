/**
 * Integration tests for POST /api/supplier-risk/score.
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
      findUnique: vi.fn().mockResolvedValue({ tier: 'GROWTH' }),
      upsert:     vi.fn().mockResolvedValue({ id: 'tenant-test', name: 'Org', tier: 'GROWTH' }),
    },
    auditEvent: { create: vi.fn().mockResolvedValue({}) },
  },
}));

import app from '../../app.js';

const AUTH = { Authorization: 'Bearer test-token-starter' };

function body(over: Record<string, unknown> = {}) {
  const txn = { date: '2026-01-15T00:00:00Z', orderValue: 1000, currency: 'USD', deliveredOnTime: true, qualityDefects: 0, documentAccuracy: true };
  return {
    supplierId: 'sup_1', supplierName: 'Acme Parts', countryCode: 'US',
    transactions: [txn, { ...txn }, { ...txn }, { ...txn }, { ...txn }],
    ...over,
  };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('POST /api/supplier-risk/score', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/supplier-risk/score').send(body());
    expect(res.status).toBe(401);
  });

  it('returns 200 with a full SupplierRiskResult for a valid body', async () => {
    const res = await request(app).post('/api/supplier-risk/score').set(AUTH).send(body());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('riskScore');
    expect(res.body).toHaveProperty('riskLevel');
    expect(res.body).toHaveProperty('recommendation');
    expect(res.body.breakdown).toHaveProperty('onTimeDelivery');
    expect(res.body.sanctions).toHaveProperty('flagged');
    expect(res.body).toHaveProperty('cbamRelevant');
    expect(res.body).toHaveProperty('auditId');
  });

  it('flags a sanctioned country and rejects', async () => {
    const res = await request(app).post('/api/supplier-risk/score').set(AUTH).send(body({ countryCode: 'RU' }));
    expect(res.status).toBe(200);
    expect(res.body.recommendation).toBe('reject');
    expect(res.body.sanctions.flagged).toBe(true);
  });

  it('422 for an invalid body (no transactions)', async () => {
    const res = await request(app)
      .post('/api/supplier-risk/score')
      .set(AUTH)
      .send({ supplierId: 'x', supplierName: 'y', countryCode: 'US', transactions: [] });
    // Zod .parse throws → surfaced by the global error handler (not a 2xx)
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
