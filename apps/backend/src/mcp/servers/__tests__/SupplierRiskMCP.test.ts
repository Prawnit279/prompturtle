import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantTier } from '@prompturtle/shared';
import type { SupplierProfileResult, SupplierRiskResult, SupplierTransaction } from '@prompturtle/shared';

import type { ToolCallContext } from '../../types.js';

// ---- Mocks ----
vi.mock('../../../lib/audit.js', () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../lib/logger.js', () => ({
  default: {
    info: vi.fn(), error: vi.fn(), warn: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

vi.mock('../../../guardrails/rules/InputSchemaRule.js', () => ({
  InputSchemaRule:    class InputSchemaRule { check = vi.fn().mockResolvedValue(null); },
  registerToolSchema: vi.fn(),
}));

vi.mock('../../../lib/cost-tracker.js', () => ({
  trackedCall: vi.fn().mockImplementation((_o: unknown, fn: () => unknown) => fn()),
  TierLimitExceededError: class TierLimitExceededError extends Error {},
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Elevated risk driven by poor on-time delivery.' }],
        usage:   { input_tokens: 20, output_tokens: 12 },
      }),
    },
  })),
}));

import { writeAuditEvent } from '../../../lib/audit.js';
import { SupplierRiskMCP } from '../SupplierRiskMCP.js';

const mockAudit = writeAuditEvent as ReturnType<typeof vi.fn>;

function makeCtx(overrides: Partial<ToolCallContext> = {}): ToolCallContext {
  return { tenantId: 'tenant-test', userId: 'user-test', tier: TenantTier.GROWTH, mcpServer: 'supplier-risk', requestId: 'req-test', ...overrides };
}

function txn(over: Partial<SupplierTransaction> = {}): SupplierTransaction {
  return {
    date: '2026-01-15T00:00:00Z', orderValue: 1000, currency: 'USD',
    deliveredOnTime: true, qualityDefects: 0, documentAccuracy: true, ...over,
  };
}

function input(over: Record<string, unknown> = {}) {
  return {
    supplierId: 'sup_1', supplierName: 'Acme Parts', countryCode: 'US',
    transactions: [txn(), txn(), txn(), txn(), txn()],
    ...over,
  };
}

let server: SupplierRiskMCP;
beforeEach(() => {
  vi.clearAllMocks();
  server = new SupplierRiskMCP();
});

async function score(over: Record<string, unknown> = {}): Promise<SupplierRiskResult> {
  const res = await server.executeTool('score_supplier', input(over), makeCtx());
  return res.data as SupplierRiskResult;
}

// ===========================================================================
describe('SupplierRiskMCP — metadata', () => {
  it('is live (not a stub) with the three tools', () => {
    expect(server.name).toBe('supplier-risk');
    expect(server.version).toBe('1.0.0');
    const names = server.tools.map((t) => t.name);
    expect(names).toEqual(['score_supplier', 'get_supplier_profile', 'list_certifications']);
  });
});

describe('score_supplier — scoring', () => {
  it('clean supplier in a low-risk country → low score, approve', async () => {
    const d = await score();
    expect(d.riskScore).toBeLessThan(30);
    expect(d.recommendation).toBe('approve');
    expect(d.riskLevel).toBe('low');
  });

  it('40% on-time → onTimeDelivery critical, at least probation', async () => {
    const d = await score({
      transactions: [txn(), txn(), txn({ deliveredOnTime: false }), txn({ deliveredOnTime: false }), txn({ deliveredOnTime: false })],
    });
    expect(d.breakdown.onTimeDelivery.level).toBe('critical');
    expect(['probation', 'reject']).toContain(d.recommendation);
  });

  it('country RU → countryRisk 95, sanctions flagged, reject', async () => {
    const d = await score({ countryCode: 'RU' });
    expect(d.breakdown.countryRisk.score).toBe(95);
    expect(d.sanctions.flagged).toBe(true);
    expect(d.sanctions.matchedList).toMatch(/OFAC/);
    expect(d.recommendation).toBe('reject');
  });

  it('compliance flags on 25% of transactions → complianceHistory high', async () => {
    const d = await score({
      transactions: [txn({ complianceFlags: ['MISSING_COO'] }), txn(), txn(), txn()],
    });
    expect(d.breakdown.complianceHistory.level).toBe('high');
  });

  it('< 3 transactions → onTimeDelivery "Insufficient history"', async () => {
    const d = await score({ transactions: [txn(), txn()] });
    expect(d.breakdown.onTimeDelivery.detail).toMatch(/Insufficient history/);
  });

  it('CBAM: hsCodesTraded includes 720810 → cbamRelevant true', async () => {
    const d = await score({ hsCodesTraded: ['720810'] });
    expect(d.cbamRelevant).toBe(true);
  });

  it('CBAM: no relevant HS codes → cbamRelevant false', async () => {
    const d = await score({ hsCodesTraded: ['854231'] });
    expect(d.cbamRelevant).toBe(false);
  });

  it('composite formula matches the weighted breakdown (case 1: clean US)', async () => {
    const d = await score();
    const expected = Math.round(
      d.breakdown.onTimeDelivery.score     * 0.30 +
      d.breakdown.qualityConsistency.score * 0.25 +
      d.breakdown.complianceHistory.score  * 0.25 +
      d.breakdown.documentAccuracy.score   * 0.15 +
      d.breakdown.countryRisk.score        * 0.05,
    );
    expect(d.riskScore).toBe(expected);
  });

  it('composite formula matches the weighted breakdown (case 2: mixed/CN)', async () => {
    const d = await score({
      countryCode: 'CN',
      transactions: [
        txn({ deliveredOnTime: false, qualityDefects: 2 }),
        txn({ qualityDefects: 1, documentAccuracy: false, complianceFlags: ['X'] }),
        txn(), txn({ deliveredOnTime: false }),
      ],
    });
    const expected = Math.round(
      d.breakdown.onTimeDelivery.score     * 0.30 +
      d.breakdown.qualityConsistency.score * 0.25 +
      d.breakdown.complianceHistory.score  * 0.25 +
      d.breakdown.documentAccuracy.score   * 0.15 +
      d.breakdown.countryRisk.score        * 0.05,
    );
    expect(d.riskScore).toBe(expected);
  });

  it('writes an audit record on every call', async () => {
    await score();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'supplier_risk', payload: expect.objectContaining({ module: 'SUPPLIER_RISK' }) }),
    );
  });

  it('returns an auditId and transaction metadata', async () => {
    const d = await score();
    expect(d.auditId).toBeTruthy();
    expect(d.transactionCount).toBe(5);
    expect(typeof d.lookbackDays).toBe('number');
  });
});

describe('score_supplier — optional model summary', () => {
  it('no summary for small histories (<10 transactions)', async () => {
    const d = await score();
    expect(d.summary).toBeUndefined();
  });

  it('adds a summary for >=10 transactions with elevated score', async () => {
    const txns = Array.from({ length: 10 }, (_, i) =>
      txn({ deliveredOnTime: i < 4, qualityDefects: 2 }), // ~40% on-time + defects → score >= 40
    );
    const d = await score({ transactions: txns });
    expect(d.riskScore).toBeGreaterThanOrEqual(40);
    expect(d.summary).toBe('Elevated risk driven by poor on-time delivery.');
  });
});

describe('get_supplier_profile', () => {
  it('returns the lightweight projection only', async () => {
    const res = await server.executeTool('get_supplier_profile', input({ countryCode: 'RU' }), makeCtx());
    const d = res.data as SupplierProfileResult;
    expect(d.recommendation).toBe('reject');
    expect(d.sanctions.flagged).toBe(true);
    expect(d).not.toHaveProperty('breakdown');
    expect(d).not.toHaveProperty('riskScore');
  });
});

describe('list_certifications', () => {
  it('returns recognized certification codes', async () => {
    const res = await server.executeTool('list_certifications', {}, makeCtx());
    const d = res.data as { certifications: Array<{ code: string }> };
    const codes = d.certifications.map((c) => c.code);
    expect(codes).toContain('ISO_9001');
    expect(codes).toContain('C_TPAT');
  });
});
