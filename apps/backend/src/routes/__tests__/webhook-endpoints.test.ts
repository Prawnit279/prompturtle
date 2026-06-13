/**
 * Integration tests for the tenant webhook management API.
 * Supertest against the full Express app with mocked dependencies.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// ---- Mocks (must be declared before app import) ----

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

// Keep test pings from hitting the network — just report a synthetic result.
vi.mock('../../lib/webhook-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/webhook-service.js')>();
  return {
    ...actual,
    sendTestPing: vi.fn().mockResolvedValue({ success: true, statusCode: 200 }),
  };
});

// Bypass real DNS/SSRF resolution in route tests; one test overrides it to reject.
vi.mock('../../lib/url-safety.js', () => ({
  assertPublicWebhookUrl: vi.fn().mockResolvedValue(undefined),
  UnsafeWebhookUrlError: class UnsafeWebhookUrlError extends Error {},
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
    webhook: {
      create:    vi.fn(),
      findMany:  vi.fn(),
      findFirst: vi.fn(),
      update:    vi.fn(),
    },
    webhookDelivery: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany:  vi.fn().mockResolvedValue([]),
      count:     vi.fn().mockResolvedValue(0),
    },
  },
}));

import app from '../../app.js';
import { prisma } from '../../lib/db.js';
import { assertPublicWebhookUrl, UnsafeWebhookUrlError } from '../../lib/url-safety.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockWebhook = (prisma.webhook as any);
const mockAssertUrl = assertPublicWebhookUrl as ReturnType<typeof vi.fn>;

const AUTH = { Authorization: 'Bearer test-token-starter' };

function publicRow(overrides: Record<string, unknown> = {}) {
  return {
    id:          'wh_1',
    url:         'https://vendor.example/hook',
    events:      ['approval.approved'],
    description: null,
    is_active:   true,
    created_at:  new Date('2026-06-01T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.tenant as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue({ tier: 'GROWTH' });
  (prisma.tenant as unknown as { upsert: ReturnType<typeof vi.fn> }).upsert.mockResolvedValue({ id: 'tenant-test', name: 'Org', tier: 'GROWTH' });
  mockAssertUrl.mockResolvedValue(undefined);
});

// ===========================================================================
describe('webhook management API', () => {
  it('returns 401 without an auth header', async () => {
    const res = await request(app).get('/api/webhooks');
    expect(res.status).toBe(401);
  });

  it('POST /api/webhooks → 201 and returns the secret once', async () => {
    mockWebhook.create.mockResolvedValue(publicRow());

    const res = await request(app)
      .post('/api/webhooks')
      .set(AUTH)
      .send({ url: 'https://vendor.example/hook', events: ['approval.approved'] });

    expect(res.status).toBe(201);
    expect(res.body.webhook).toHaveProperty('secret');
    expect(res.body.webhook.secret).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.webhook.url).toBe('https://vendor.example/hook');
  });

  it('POST /api/webhooks → 400 for a non-https url', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .set(AUTH)
      .send({ url: 'http://insecure.example/hook', events: ['approval.approved'] });

    expect(res.status).toBe(400);
    expect(mockWebhook.create).not.toHaveBeenCalled();
  });

  it('POST /api/webhooks → 400 for an unknown event type', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .set(AUTH)
      .send({ url: 'https://vendor.example/hook', events: ['not.a.real.event'] });

    expect(res.status).toBe(400);
  });

  it('POST /api/webhooks → 400 when the url resolves to a non-public address (SSRF)', async () => {
    mockAssertUrl.mockRejectedValueOnce(new UnsafeWebhookUrlError('url resolves to a non-public address'));

    const res = await request(app)
      .post('/api/webhooks')
      .set(AUTH)
      .send({ url: 'https://169.254.169.254/hook', events: ['approval.approved'] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unsafe_url');
    expect(mockWebhook.create).not.toHaveBeenCalled();
  });

  it('GET /api/webhooks → 200 with no secret field in any item', async () => {
    mockWebhook.findMany.mockResolvedValue([publicRow(), publicRow({ id: 'wh_2' })]);

    const res = await request(app).get('/api/webhooks').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.webhooks).toHaveLength(2);
    for (const wh of res.body.webhooks) {
      expect(wh).not.toHaveProperty('secret');
    }
  });

  it('DELETE /api/webhooks/:id → soft-deletes (is_active=false) and returns 204', async () => {
    mockWebhook.findFirst.mockResolvedValue({ id: 'wh_1' });
    mockWebhook.update.mockResolvedValue(publicRow({ is_active: false }));

    const res = await request(app).delete('/api/webhooks/wh_1').set(AUTH);

    expect(res.status).toBe(204);
    expect(mockWebhook.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'wh_1' }, data: { is_active: false } }),
    );
  });

  it('cannot read another tenant\'s webhook deliveries → 404', async () => {
    mockWebhook.findFirst.mockResolvedValue(null); // tenant-scoped lookup misses

    const res = await request(app).get('/api/webhooks/wh_other/deliveries').set(AUTH);

    expect(res.status).toBe(404);
  });

  it('cannot modify another tenant\'s webhook → 404', async () => {
    mockWebhook.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/webhooks/wh_other')
      .set(AUTH)
      .send({ isActive: false });

    expect(res.status).toBe(404);
    expect(mockWebhook.update).not.toHaveBeenCalled();
  });

  it('PATCH /api/webhooks/:id → updates allowed fields', async () => {
    mockWebhook.findFirst.mockResolvedValue({ id: 'wh_1' });
    mockWebhook.update.mockResolvedValue(publicRow({ description: 'prod', events: ['decision.halted'] }));

    const res = await request(app)
      .patch('/api/webhooks/wh_1')
      .set(AUTH)
      .send({ description: 'prod', events: ['decision.halted'] });

    expect(res.status).toBe(200);
    expect(res.body.webhook.description).toBe('prod');
    expect(res.body.webhook).not.toHaveProperty('secret');
  });

  it('POST /api/webhooks/:id/test → sends a test ping and reports the result', async () => {
    mockWebhook.findFirst.mockResolvedValue({ id: 'wh_1', url: 'https://vendor.example/hook', secret: 's' });

    const res = await request(app).post('/api/webhooks/wh_1/test').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, statusCode: 200 });
  });
});
