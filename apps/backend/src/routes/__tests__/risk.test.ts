/**
 * Integration tests for POST /api/risk/score.
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
      upsert:     vi.fn().mockResolvedValue({ id: 'tenant-test', name: 'Organization', tier: 'GROWTH' }),
    },
    auditEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
    guardrailConfig: {
      findUnique: vi.fn().mockResolvedValue(null), // no config → platform defaults
    },
  },
}));

// Import after mocks
import app from '../../app.js';

const AUTH = { Authorization: 'Bearer test-token-starter' };

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
describe('POST /api/risk/score', () => {
  it('returns 401 when no auth header is provided', async () => {
    const res = await request(app).post('/api/risk/score').send({});
    expect(res.status).toBe(401);
  });

  it('returns 200 with a full ShipmentRiskResult for a valid body', async () => {
    const res = await request(app)
      .post('/api/risk/score')
      .set(AUTH)
      .send({
        htsResult: { hsCode: '8471.30.01', confidence: 0.92 },
        carrierResult: { carrier: 'Approved Co', isApprovedCarrier: true },
        shipmentCost: { total: 2500, currency: 'USD' },
        customsRequired: false,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('riskScore');
    expect(res.body).toHaveProperty('riskLevel');
    expect(res.body).toHaveProperty('recommendation');
    expect(res.body).toHaveProperty('breakdown');
    expect(res.body).toHaveProperty('guardrailsFired');
    expect(res.body).toHaveProperty('auditId');
    expect(res.body).toHaveProperty('decision');
  });

  it('returns 200 (not 422) for an empty body, with all factors "not evaluated"', async () => {
    const res = await request(app)
      .post('/api/risk/score')
      .set(AUTH)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.breakdown.htsConfidence.signals).toContain('hts_not_evaluated');
    expect(res.body.breakdown.carrierApproval.signals).toContain('carrier_not_evaluated');
    expect(res.body.breakdown.costThreshold.signals).toContain('cost_not_evaluated');
    expect(res.body.breakdown.customsReadiness.signals).toContain('customs_not_required');
    expect(res.body.breakdown.complianceFlags.signals).toContain('compliance_clean');
  });

  it('returns a halted decision when a critical compliance flag is present', async () => {
    const res = await request(app)
      .post('/api/risk/score')
      .set(AUTH)
      .send({
        complianceFlags: [
          { code: 'CUSTOMS_BROKER_UNVERIFIED', severity: 'critical', message: 'unverified broker' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('halted');
    expect(res.body.recommendation).toBe('halt');
    expect(res.body.guardrailsFired).toContain('audit_trail');
  });
});
