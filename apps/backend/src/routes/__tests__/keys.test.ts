/**
 * Integration tests for /api/keys, /api/usage, /api/logs routes.
 * Uses supertest against the full Express app with mocked dependencies.
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
  InputSchemaRule:    class InputSchemaRule { check = vi.fn().mockResolvedValue(null); },
  registerToolSchema: vi.fn(),
}));

vi.mock('../../data/hts-ingest.js', () => ({
  searchHtsCodes: vi.fn().mockResolvedValue([]),
}));

// Suppress stripe.ts module-level env check (billing routes now imported via app.ts)
vi.mock('../../lib/stripe.js', () => ({
  stripe: {
    customers:     { create: vi.fn() },
    checkout:      { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
  },
}));

// Mock Clerk — test token resolves to tenant-test / user-test
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

// Mock Prisma — controlled responses per test
vi.mock('../../lib/db.js', () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(null),
      update:     vi.fn().mockResolvedValue({}),
      upsert:     vi.fn().mockResolvedValue({ id: 'tenant-test', name: 'Organization', tier: 'STARTER' }),
    },
    apiKey: {
      findMany:   vi.fn().mockResolvedValue([]),
      findFirst:  vi.fn().mockResolvedValue(null),
      create:     vi.fn(),
      update:     vi.fn().mockResolvedValue({}),
    },
    toolCall: {
      count:    vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy:  vi.fn().mockResolvedValue([]),
    },
  },
  db: {
    apiKey: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Import after mocks
import { prisma } from '../../lib/db.js';
import app from '../../app.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockApiKey  = (prisma.apiKey  as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockToolCall = (prisma.toolCall as any);

const AUTH = { Authorization: 'Bearer test-token-starter' };

const SAMPLE_KEY_ROW = {
  id:          'key-uuid-001',
  name:        'Production',
  prefix:      'ptk_abcdef',
  created_at:  new Date('2026-01-01T00:00:00Z'),
  last_used_at: null,
};

const SAMPLE_CALL_ROW = {
  id:            'call-uuid-001',
  mcp_server:    'bol-processor',
  tool_name:     'extract_bol_fields',
  model_used:    'claude-sonnet-4-6',
  input_tokens:  200,
  output_tokens: 100,
  cost_usd:      0.000300,
  latency_ms:    850,
  success:       true,
  created_at:    new Date('2026-01-01T10:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  // Reset defaults
  mockApiKey.findMany.mockResolvedValue([SAMPLE_KEY_ROW]);
  mockApiKey.findFirst.mockResolvedValue(null);
  mockApiKey.create.mockResolvedValue({
    id:         'key-uuid-new',
    name:       'Test Key',
    prefix:     'ptk_testtoke',
    created_at: new Date(),
  });
  mockToolCall.count.mockResolvedValue(0);
  mockToolCall.findMany.mockResolvedValue([]);
  mockToolCall.groupBy.mockResolvedValue([]);
});

// ===========================================================================
describe('GET /api/keys', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/keys');
    expect(res.status).toBe(401);
  });

  it('returns array for authed tenant', async () => {
    const res = await request(app).get('/api/keys').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.keys).toBeInstanceOf(Array);
  });

  it('maps snake_case DB fields to camelCase response', async () => {
    const res = await request(app).get('/api/keys').set(AUTH);
    const key = res.body.keys[0] as Record<string, unknown>;
    expect(key).toHaveProperty('createdAt');
    expect(key).toHaveProperty('lastUsedAt');
    expect(key).not.toHaveProperty('created_at');
  });

  it('queries only non-revoked keys for the tenant', async () => {
    await request(app).get('/api/keys').set(AUTH);
    expect(mockApiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ revoked_at: null }),
      }),
    );
  });
});

// ===========================================================================
describe('POST /api/keys', () => {
  it('creates key and returns raw once', async () => {
    const res = await request(app).post('/api/keys').set(AUTH).send({ name: 'Test Key' });
    expect(res.status).toBe(201);
    expect(res.body.key.raw).toMatch(/^ptk_/);
    expect(res.body.key.prefix).toMatch(/^ptk_/);
  });

  it('rejects missing name', async () => {
    const res = await request(app).post('/api/keys').set(AUTH).send({});
    expect(res.status).toBe(400);
  });

  it('rejects empty name', async () => {
    const res = await request(app).post('/api/keys').set(AUTH).send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  it('stores sha256 hash, not raw key', async () => {
    await request(app).post('/api/keys').set(AUTH).send({ name: 'Test' });
    const createCall = mockApiKey.create.mock.calls[0]?.[0] as {
      data: { key_hash: string; prefix: string };
    };
    // hash should NOT start with ptk_ (raw key would start with ptk_)
    expect(createCall.data.key_hash).not.toMatch(/^ptk_/);
    expect(createCall.data.prefix).toMatch(/^ptk_/);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/keys').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
describe('DELETE /api/keys/:id', () => {
  it('returns 404 for unknown key', async () => {
    mockApiKey.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).delete('/api/keys/nonexistent').set(AUTH);
    expect(res.status).toBe(404);
  });

  it('soft-revokes existing key and returns 204', async () => {
    mockApiKey.findFirst.mockResolvedValueOnce(SAMPLE_KEY_ROW);
    const res = await request(app).delete('/api/keys/key-uuid-001').set(AUTH);
    expect(res.status).toBe(204);
    expect(mockApiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revoked_at: expect.any(Date) }),
      }),
    );
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/keys/key-uuid-001');
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
describe('GET /api/usage', () => {
  it('returns usage summary shape', async () => {
    mockToolCall.groupBy.mockResolvedValue([
      { mcp_server: 'bol-processor', _sum: { cost_usd: 0.005, input_tokens: 500, output_tokens: 200 }, _count: { id: 3 } },
    ]);

    const res = await request(app).get('/api/usage').set(AUTH);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalCostUsd).toBe('number');
    expect(typeof res.body.totalCalls).toBe('number');
    expect(res.body.byServer).toBeInstanceOf(Array);
    expect(res.body.byServer[0].server).toBe('bol-processor');
  });

  it('defaults to 30 day window and scopes by tenant', async () => {
    await request(app).get('/api/usage').set(AUTH);
    expect(mockToolCall.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ created_at: expect.any(Object) }) }),
    );
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/usage');
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
describe('GET /api/logs', () => {
  it('returns paginated logs', async () => {
    mockToolCall.count.mockResolvedValue(1);
    mockToolCall.findMany.mockResolvedValue([SAMPLE_CALL_ROW]);

    const res = await request(app).get('/api/logs').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.calls).toBeInstanceOf(Array);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.page).toBe(1);
    expect(res.body.pages).toBeDefined();
  });

  it('maps success boolean to status string', async () => {
    mockToolCall.count.mockResolvedValue(1);
    mockToolCall.findMany.mockResolvedValue([SAMPLE_CALL_ROW]);

    const res = await request(app).get('/api/logs').set(AUTH);
    expect(res.body.calls[0].status).toBe('SUCCESS');
  });

  it('filters by server when query param provided', async () => {
    await request(app).get('/api/logs?server=bol-processor').set(AUTH);
    expect(mockToolCall.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ mcp_server: 'bol-processor' }),
      }),
    );
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/logs');
    expect(res.status).toBe(401);
  });
});
