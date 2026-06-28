/**
 * Integration tests for the carbon routes.
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
    auditEvent: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import app from '../../app.js';

const AUTH = { Authorization: 'Bearer test-token-starter' };

beforeEach(() => { vi.clearAllMocks(); });

describe('GET /api/carbon/factors (public)', () => {
  it('returns all five GLEC factors without auth', async () => {
    const res = await request(app).get('/api/carbon/factors');
    expect(res.status).toBe(200);
    expect(res.body.factors).toHaveLength(5);
    expect(res.body.factors[0]).toHaveProperty('glecVersion', '3.0');
  });
});

describe('POST /api/carbon/calculate', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/carbon/calculate').send({ mode: 'TRUCK', weightKg: 1000, distanceKm: 100 });
    expect(res.status).toBe(401);
  });

  it('returns a CarbonCalculationResult for a valid body', async () => {
    const res = await request(app).post('/api/carbon/calculate').set(AUTH).send({ mode: 'TRUCK', weightKg: 10000, distanceKm: 500, hsCodes: ['720810'] });
    expect(res.status).toBe(200);
    expect(res.body.co2eKg).toBe(480);
    expect(res.body.cbam.inScope).toBe(true);
    expect(res.body).toHaveProperty('auditId');
  });

  it('returns 422 for a body missing mode', async () => {
    const res = await request(app).post('/api/carbon/calculate').set(AUTH).send({ weightKg: 1000, distanceKm: 100 });
    expect(res.status).toBe(422);
  });
});
