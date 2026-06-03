/**
 * CORS integration tests — verifies allowed/blocked origins via supertest.
 * Uses the full Express app stack with all dependencies mocked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// ---- Mocks ----

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

vi.mock('../../lib/stripe.js', () => ({
  stripe: {
    webhooks:      { constructEvent: vi.fn() },
    customers:     { create: vi.fn() },
    checkout:      { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
  },
}));

vi.mock('../../lib/email.js', () => ({
  sendWelcomeEmail:             vi.fn().mockResolvedValue({ success: true }),
  sendBillingConfirmationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendUsageWarningEmail:        vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../lib/usage-monitor.js', () => ({
  checkAndWarnUsage: vi.fn().mockResolvedValue(undefined),
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

vi.mock('@clerk/clerk-sdk-node', () => ({
  createClerkClient: vi.fn(() => ({
    verifyToken: vi.fn().mockRejectedValue(new Error('Invalid token')),
  })),
}));

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockReturnValue({ type: 'unknown', data: {} }),
  })),
}));

vi.mock('../../lib/db.js', () => ({
  prisma: {
    processedWebhook: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    tenant:   { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue({}) },
    apiKey:   { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    toolCall: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
  },
  db: {},
}));

import app from '../../app.js';

beforeEach(() => { vi.clearAllMocks(); });

// ===========================================================================
describe('CORS', () => {
  it('includes Access-Control-Allow-Origin for an allowed origin', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('blocks requests from disallowed origins', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://evil.example.com');

    // callback(null, false) means CORS silently withholds the header;
    // the server responds normally but the browser rejects the response.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows server-to-server requests with no Origin header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
