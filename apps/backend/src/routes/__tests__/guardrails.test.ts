/**
 * Integration tests for the per-tenant guardrail config API.
 * Supertest against the full Express app with mocked dependencies.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// ---- Mocks (declared before app import) ----

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
      if (token === 'tok-a') return Promise.resolve({ sub: 'user-a', org_id: 'tenant-a' });
      if (token === 'tok-b') return Promise.resolve({ sub: 'user-b', org_id: 'tenant-b' });
      return Promise.reject(new Error('Invalid token'));
    }),
  })),
}));

vi.mock('../../lib/db.js', () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ tier: 'GROWTH' }),
      upsert:     vi.fn().mockResolvedValue({ id: 'tenant-a', name: 'Org', tier: 'GROWTH' }),
    },
    guardrailConfig: {
      findUnique: vi.fn(),
      upsert:     vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

import app from '../../app.js';
import { prisma } from '../../lib/db.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockConfig = (prisma.guardrailConfig as any);

const AUTH_A = { Authorization: 'Bearer tok-a' };

function row(overrides: Record<string, unknown> = {}) {
  return {
    id:                    'gc_1',
    tenant_id:             'tenant-a',
    cost_threshold:        10000,
    approved_carriers:     [],
    require_broker_verify: true,
    auto_approve_below:    0,
    updated_at:            new Date('2026-06-18T10:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.tenant as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue({ tier: 'GROWTH' });
  (prisma.tenant as unknown as { upsert: ReturnType<typeof vi.fn> }).upsert.mockResolvedValue({ id: 'tenant-a', name: 'Org', tier: 'GROWTH' });
  mockConfig.deleteMany.mockResolvedValue({ count: 1 });
});

// ===========================================================================
describe('guardrail config API', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/guardrails/config');
    expect(res.status).toBe(401);
  });

  it('GET → 200 with defaults and isDefault:true when no config is set', async () => {
    mockConfig.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/guardrails/config').set(AUTH_A);

    expect(res.status).toBe(200);
    expect(res.body.isDefault).toBe(true);
    expect(res.body.costThreshold).toBe(10000);
    expect(res.body.approvedCarriers).toEqual([]);
    expect(res.body.requireBrokerVerify).toBe(true);
  });

  it('PATCH { costThreshold: 50000 } → 200 with the updated config', async () => {
    mockConfig.findUnique.mockResolvedValue(null); // for cross-field validation lookup
    mockConfig.upsert.mockResolvedValue(row({ cost_threshold: 50000 }));

    const res = await request(app)
      .patch('/api/guardrails/config')
      .set(AUTH_A)
      .send({ costThreshold: 50000 });

    expect(res.status).toBe(200);
    expect(res.body.costThreshold).toBe(50000);
    expect(mockConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenant_id: 'tenant-a' } }),
    );
  });

  it('PATCH with autoApproveBelow >= costThreshold → 422', async () => {
    mockConfig.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/guardrails/config')
      .set(AUTH_A)
      .send({ costThreshold: 1000, autoApproveBelow: 1000 });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/autoApproveBelow/);
    expect(mockConfig.upsert).not.toHaveBeenCalled();
  });

  it('PATCH with costThreshold <= 0 → 422', async () => {
    mockConfig.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/guardrails/config')
      .set(AUTH_A)
      .send({ costThreshold: 0 });

    expect(res.status).toBe(422);
  });

  it('PATCH ignores unknown fields without erroring', async () => {
    mockConfig.findUnique.mockResolvedValue(null);
    mockConfig.upsert.mockResolvedValue(row({ require_broker_verify: false }));

    const res = await request(app)
      .patch('/api/guardrails/config')
      .set(AUTH_A)
      .send({ requireBrokerVerify: false, somethingUnknown: 'ignored' });

    expect(res.status).toBe(200);
    const upsertArg = mockConfig.upsert.mock.calls[0]?.[0] as { update: Record<string, unknown> };
    expect(upsertArg.update).not.toHaveProperty('somethingUnknown');
  });

  it('DELETE → 204 and a subsequent GET returns defaults', async () => {
    const del = await request(app).delete('/api/guardrails/config').set(AUTH_A);
    expect(del.status).toBe(204);
    expect(mockConfig.deleteMany).toHaveBeenCalledWith({ where: { tenant_id: 'tenant-a' } });

    mockConfig.findUnique.mockResolvedValue(null);
    const get = await request(app).get('/api/guardrails/config').set(AUTH_A);
    expect(get.body.isDefault).toBe(true);
  });

  it('is tenant-scoped: tenant B never sees tenant A\'s config', async () => {
    // The route always queries by the caller's own tenant id; tenant B's lookup
    // is scoped to tenant-b, so it can only ever get its own row (here: none).
    mockConfig.findUnique.mockImplementation(({ where }: { where: { tenant_id: string } }) =>
      Promise.resolve(where.tenant_id === 'tenant-a' ? row({ cost_threshold: 99999 }) : null),
    );

    const res = await request(app).get('/api/guardrails/config').set({ Authorization: 'Bearer tok-b' });

    expect(res.status).toBe(200);
    expect(res.body.costThreshold).toBe(10000); // defaults, NOT tenant A's 99999
    expect(res.body.isDefault).toBe(true);
  });
});
