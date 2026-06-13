import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditAction, TenantTier } from '@prompturtle/shared';
import type { ShipmentRiskResult } from '@prompturtle/shared';

import type { ToolCallContext } from '../../types.js';
import { RiskScorerMCP } from '../RiskScorerMCP.js';

// ---- Mocks ----
vi.mock('../../../lib/audit.js', () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../lib/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

vi.mock('../../../guardrails/rules/InputSchemaRule.js', () => ({
  InputSchemaRule:    class InputSchemaRule { check = vi.fn().mockResolvedValue(null); },
  registerToolSchema: vi.fn(),
}));

import { writeAuditEvent } from '../../../lib/audit.js';

const mockWriteAuditEvent = writeAuditEvent as ReturnType<typeof vi.fn>;

function makeCtx(overrides: Partial<ToolCallContext> = {}): ToolCallContext {
  return {
    tenantId: 'tenant-test',
    userId: 'user-test',
    tier: TenantTier.GROWTH,
    mcpServer: 'risk-scorer',
    requestId: 'req-test',
    ...overrides,
  };
}

let server: RiskScorerMCP;

beforeEach(() => {
  vi.clearAllMocks();
  server = new RiskScorerMCP();
});

// ===========================================================================
describe('RiskScorerMCP — metadata', () => {
  it('has correct name and version', () => {
    expect(server.name).toBe('risk-scorer');
    expect(server.version).toBe('1.0.0');
  });

  it('exposes exactly 1 tool', () => {
    expect(server.tools).toHaveLength(1);
    expect(server.tools[0]?.name).toBe('score_shipment');
  });

  it('throws for unknown tool', async () => {
    await expect(
      server.executeTool('ghost', {}, makeCtx()),
    ).rejects.toThrow("Tool 'ghost' not found");
  });
});

// ===========================================================================
describe('score_shipment — htsConfidence factor', () => {
  it('scores 50/medium when no HTS result is provided', async () => {
    const result = await server.executeTool('score_shipment', {}, makeCtx());
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.htsConfidence.score).toBe(50);
    expect(data.breakdown.htsConfidence.level).toBe('medium');
  });

  it('scores 0/low when confidence >= 0.85', async () => {
    const result = await server.executeTool(
      'score_shipment',
      { htsResult: { hsCode: '8471.30.01', confidence: 0.9 } },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.htsConfidence.score).toBe(0);
    expect(data.breakdown.htsConfidence.level).toBe('low');
  });

  it('scores 35/medium when confidence is 0.70-0.84', async () => {
    const result = await server.executeTool(
      'score_shipment',
      { htsResult: { hsCode: '8471.30.01', confidence: 0.75 } },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.htsConfidence.score).toBe(35);
    expect(data.breakdown.htsConfidence.level).toBe('medium');
  });

  it('scores 65/high when confidence is 0.50-0.69', async () => {
    const result = await server.executeTool(
      'score_shipment',
      { htsResult: { hsCode: '8471.30.01', confidence: 0.6 } },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.htsConfidence.score).toBe(65);
    expect(data.breakdown.htsConfidence.level).toBe('high');
  });

  it('scores 90/critical when confidence < 0.50', async () => {
    const result = await server.executeTool(
      'score_shipment',
      { htsResult: { hsCode: '8471.30.01', confidence: 0.3 } },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.htsConfidence.score).toBe(90);
    expect(data.breakdown.htsConfidence.level).toBe('critical');
  });

  it('scores 40/medium when hsCode is present without confidence', async () => {
    const result = await server.executeTool(
      'score_shipment',
      { htsResult: { hsCode: '8471.30.01' } },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.htsConfidence.score).toBe(40);
    expect(data.breakdown.htsConfidence.level).toBe('medium');
  });
});

// ===========================================================================
describe('score_shipment — complianceFlags factor', () => {
  it('scores 0/low when no flags are raised', async () => {
    const result = await server.executeTool('score_shipment', {}, makeCtx());
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.complianceFlags.score).toBe(0);
    expect(data.breakdown.complianceFlags.level).toBe('low');
  });

  it('scores 95/critical when a critical flag is present', async () => {
    const result = await server.executeTool(
      'score_shipment',
      {
        complianceFlags: [
          { code: 'CUSTOMS_BROKER_UNVERIFIED', severity: 'critical', message: 'unverified broker' },
        ],
      },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.complianceFlags.score).toBe(95);
    expect(data.breakdown.complianceFlags.level).toBe('critical');
  });
});

// ===========================================================================
describe('score_shipment — carrierApproval factor', () => {
  it('scores 60/high and fires new_carrier_check for an unapproved carrier', async () => {
    const result = await server.executeTool(
      'score_shipment',
      { carrierResult: { carrier: 'Acme Freight', isApprovedCarrier: false } },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.carrierApproval.score).toBe(60);
    expect(data.breakdown.carrierApproval.level).toBe('high');
    expect(data.guardrailsFired).toContain('new_carrier_check');
  });

  it('adds 20 (capped at 100) when carrier score < 50', async () => {
    const result = await server.executeTool(
      'score_shipment',
      { carrierResult: { carrier: 'Acme Freight', isApprovedCarrier: false, score: 30 } },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.carrierApproval.score).toBe(80);
  });
});

// ===========================================================================
describe('score_shipment — costThreshold factor', () => {
  it('scores 90/critical and fires high_cost_approval above the $10,000 threshold', async () => {
    const result = await server.executeTool(
      'score_shipment',
      { shipmentCost: { total: 15_000, currency: 'USD' } },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.costThreshold.score).toBe(90);
    expect(data.breakdown.costThreshold.level).toBe('critical');
    expect(data.guardrailsFired).toContain('high_cost_approval');
  });
});

// ===========================================================================
describe('score_shipment — customsReadiness factor', () => {
  it('scores 80/critical and fires customs_flag for an unverified broker', async () => {
    const result = await server.executeTool(
      'score_shipment',
      { customsRequired: true, customsBroker: { name: 'Acme Customs', verified: false } },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.customsReadiness.score).toBe(80);
    expect(data.breakdown.customsReadiness.level).toBe('critical');
    expect(data.guardrailsFired).toContain('customs_flag');
  });

  it('scores 10/low for a verified broker', async () => {
    const result = await server.executeTool(
      'score_shipment',
      { customsRequired: true, customsBroker: { name: 'Acme Customs', verified: true } },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.customsReadiness.score).toBe(10);
    expect(data.breakdown.customsReadiness.level).toBe('low');
  });

  it('scores 50/medium when required but no broker on file', async () => {
    const result = await server.executeTool(
      'score_shipment',
      { customsRequired: true },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.customsReadiness.score).toBe(50);
    expect(data.breakdown.customsReadiness.level).toBe('medium');
  });
});

// ===========================================================================
describe('score_shipment — composite formula', () => {
  it('returns 0/low/proceed/accepted for an entirely clean shipment', async () => {
    const result = await server.executeTool(
      'score_shipment',
      {
        htsResult: { hsCode: '8471.30.01', confidence: 0.95 },
        carrierResult: { carrier: 'Approved Co', isApprovedCarrier: true },
        shipmentCost: { total: 1000, currency: 'USD' },
        customsRequired: false,
      },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    expect(data.riskScore).toBe(0);
    expect(data.riskLevel).toBe('low');
    expect(data.recommendation).toBe('proceed');
    expect(data.decision).toBe('accepted');
  });

  it('computes the weighted composite for a mixed-risk shipment', async () => {
    const result = await server.executeTool(
      'score_shipment',
      {
        // htsConfidence: 35 (0.70-0.84) * 0.25 = 8.75
        htsResult: { hsCode: '8471.30.01', confidence: 0.75 },
        // complianceFlags: 0 (none) * 0.30 = 0
        // carrierApproval: 0 (approved) * 0.20 = 0
        carrierResult: { carrier: 'Approved Co', isApprovedCarrier: true },
        // costThreshold: 20 (<=0.8x) * 0.15 = 3
        shipmentCost: { total: 7000, currency: 'USD' },
        // customsReadiness: 0 (not required) * 0.10 = 0
        customsRequired: false,
      },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    // 8.75 + 0 + 0 + 3 + 0 = 11.75 -> rounds to 12
    expect(data.riskScore).toBe(12);
    expect(data.riskLevel).toBe('low');
    expect(data.recommendation).toBe('proceed');
  });

  it('halts when any factor is critical, even with a low composite score', async () => {
    const result = await server.executeTool(
      'score_shipment',
      {
        // htsConfidence: 0 * 0.25 = 0
        htsResult: { hsCode: '8471.30.01', confidence: 0.95 },
        // complianceFlags: 0 * 0.30 = 0
        // carrierApproval: 0 * 0.20 = 0
        carrierResult: { carrier: 'Approved Co', isApprovedCarrier: true },
        // costThreshold: 0 * 0.15 = 0
        shipmentCost: { total: 100, currency: 'USD' },
        // customsReadiness: 80 (critical) * 0.10 = 8
        customsRequired: true,
        customsBroker: { name: 'Acme Customs', verified: false },
      },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;
    expect(data.riskScore).toBe(8);
    expect(data.riskLevel).toBe('low');
    expect(data.recommendation).toBe('halt');
    expect(data.decision).toBe('halted');
  });
});

// ===========================================================================
describe('score_shipment — audit trail', () => {
  it('writes an audit event for a clean (accepted) shipment', async () => {
    const result = await server.executeTool('score_shipment', {}, makeCtx());
    const data = result.data as ShipmentRiskResult;

    expect(mockWriteAuditEvent).toHaveBeenCalledOnce();
    const call = mockWriteAuditEvent.mock.calls[0]?.[0];
    expect(call.tenantId).toBe('tenant-test');
    expect(call.action).toBe(AuditAction.TOOL_CALL);
    expect(call.entityType).toBe('risk_score');
    expect(call.entityId).toBe(data.auditId);
    expect(call.payload.module).toBe('RISK_SCORING');
  });

  it('writes an audit event even when the decision is halted', async () => {
    const result = await server.executeTool(
      'score_shipment',
      {
        complianceFlags: [
          { code: 'CUSTOMS_BROKER_UNVERIFIED', severity: 'critical', message: 'unverified broker' },
        ],
      },
      makeCtx(),
    );
    const data = result.data as ShipmentRiskResult;

    expect(data.decision).toBe('halted');
    expect(mockWriteAuditEvent).toHaveBeenCalledOnce();
    const call = mockWriteAuditEvent.mock.calls[0]?.[0];
    expect(call.entityId).toBe(data.auditId);
    expect(call.payload.result).toMatchObject({ decision: 'halted' });
  });

  it('always includes audit_trail in guardrailsFired', async () => {
    const result = await server.executeTool('score_shipment', {}, makeCtx());
    const data = result.data as ShipmentRiskResult;
    expect(data.guardrailsFired).toContain('audit_trail');
  });
});

// ===========================================================================
describe('score_shipment — empty input', () => {
  it('returns a fully "not evaluated" breakdown for an empty body', async () => {
    const result = await server.executeTool('score_shipment', {}, makeCtx());
    expect(result.success).toBe(true);
    const data = result.data as ShipmentRiskResult;
    expect(data.breakdown.htsConfidence.signals).toContain('hts_not_evaluated');
    expect(data.breakdown.complianceFlags.signals).toContain('compliance_clean');
    expect(data.breakdown.carrierApproval.signals).toContain('carrier_not_evaluated');
    expect(data.breakdown.costThreshold.signals).toContain('cost_not_evaluated');
    expect(data.breakdown.customsReadiness.signals).toContain('customs_not_required');
  });
});
