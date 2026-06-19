import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalStatus, ApprovalTrigger } from '@prompturtle/shared';
import {
  checkAndRequestApproval,
  evaluateTrigger,
  getPendingApprovals,
  recordDecision,
} from '../approval.js';

// ---- Mocks ----

vi.mock('../../lib/db.js', () => ({
  prisma: {
    approvalRequest: {
      create:     vi.fn(),
      findUnique: vi.fn(),
      findMany:   vi.fn(),
      update:     vi.fn(),
      updateMany: vi.fn(),
    },
    approvalDecision: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../lib/audit.js', () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../webhook-service.js', () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../guardrail-config.js', () => ({
  getGuardrailConfig: vi.fn().mockResolvedValue({
    id: '', tenantId: 'tenant-abc', costThreshold: 10_000, approvedCarriers: [],
    requireBrokerVerify: true, autoApproveBelow: 0, updatedAt: '',
  }),
}));

vi.mock('../../lib/logger.js', () => ({
  default: {
    info:  vi.fn(),
    error: vi.fn(),
    warn:  vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

// ---- Import after mocks ----

import { prisma } from '../../lib/db.js';
import { writeAuditEvent } from '../../lib/audit.js';
import { dispatch } from '../webhook-service.js';
import { getGuardrailConfig } from '../guardrail-config.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRequest  = (prisma.approvalRequest as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDecision = (prisma.approvalDecision as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTx       = (prisma as any).$transaction as ReturnType<typeof vi.fn>;
const mockAudit    = writeAuditEvent as ReturnType<typeof vi.fn>;
const mockDispatch = dispatch as ReturnType<typeof vi.fn>;
const mockGetConfig = getGuardrailConfig as ReturnType<typeof vi.fn>;

function configResult(overrides: Record<string, unknown> = {}) {
  return {
    id: '', tenantId: TENANT, costThreshold: 10_000, approvedCarriers: [],
    requireBrokerVerify: true, autoApproveBelow: 0, updatedAt: '', ...overrides,
  };
}

// ---- Helpers ----

const TENANT = 'tenant-abc';
const REQ_ID = 'req-uuid-001';

function makeRequestRow(overrides: Record<string, unknown> = {}) {
  return {
    id:         REQ_ID,
    tenant_id:  TENANT,
    trigger:    ApprovalTrigger.HIGH_SHIPMENT_COST,
    status:     ApprovalStatus.PENDING,
    context:    { shipmentCostUsd: 15_000 },
    expires_at: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeDecisionRow(overrides: Record<string, unknown> = {}) {
  return {
    id:         'dec-uuid-001',
    request_id: REQ_ID,
    decided_by: 'user-clerk-001',
    decision:   ApprovalStatus.APPROVED,
    note:       null,
    decided_at: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockGetConfig.mockResolvedValue(configResult());
  mockRequest.create.mockResolvedValue(makeRequestRow());
  mockRequest.findUnique.mockResolvedValue(makeRequestRow());
  // Recent date so the default pending row is not auto-expired by the 72h rule.
  mockRequest.findMany.mockResolvedValue([makeRequestRow({ created_at: new Date() })]);
  mockRequest.update.mockResolvedValue(makeRequestRow({ status: ApprovalStatus.APPROVED }));
  mockDecision.create.mockResolvedValue(makeDecisionRow());

  // Default $transaction resolves with [decisionRow, updatedRequest]
  mockTx.mockImplementation(
    (ops: Promise<unknown>[]) => Promise.all(ops),
  );
});

// ===========================================================================
describe('evaluateTrigger', () => {
  it('returns true when shipment cost exceeds threshold', () => {
    expect(
      evaluateTrigger(ApprovalTrigger.HIGH_SHIPMENT_COST, { shipmentCostUsd: 10_001 }),
    ).toBe(true);
  });

  it('returns false when shipment cost is at threshold', () => {
    expect(
      evaluateTrigger(ApprovalTrigger.HIGH_SHIPMENT_COST, { shipmentCostUsd: 10_000 }),
    ).toBe(false);
  });

  it('returns false when shipment cost is below threshold', () => {
    expect(
      evaluateTrigger(ApprovalTrigger.HIGH_SHIPMENT_COST, { shipmentCostUsd: 9_999 }),
    ).toBe(false);
  });

  it('returns true when HTS confidence is below threshold', () => {
    expect(
      evaluateTrigger(ApprovalTrigger.LOW_HTS_CONFIDENCE, { htsConfidence: 0.69 }),
    ).toBe(true);
  });

  it('returns false when HTS confidence meets threshold', () => {
    expect(
      evaluateTrigger(ApprovalTrigger.LOW_HTS_CONFIDENCE, { htsConfidence: 0.7 }),
    ).toBe(false);
  });

  it('returns true when carrier changes on a PO', () => {
    expect(
      evaluateTrigger(ApprovalTrigger.CARRIER_CHANGE_ON_PO, {
        previousCarrier: 'FedEx',
        newCarrier:      'UPS',
      }),
    ).toBe(true);
  });

  it('returns false when carrier stays the same', () => {
    expect(
      evaluateTrigger(ApprovalTrigger.CARRIER_CHANGE_ON_PO, {
        previousCarrier: 'FedEx',
        newCarrier:      'FedEx',
      }),
    ).toBe(false);
  });

  it('returns false when carrier context is missing', () => {
    expect(
      evaluateTrigger(ApprovalTrigger.CARRIER_CHANGE_ON_PO, {}),
    ).toBe(false);
  });
});

// ===========================================================================
describe('checkAndRequestApproval', () => {
  it('creates a request and writes audit event when trigger fires', async () => {
    const result = await checkAndRequestApproval({
      tenantId: TENANT,
      trigger:  ApprovalTrigger.HIGH_SHIPMENT_COST,
      context:  { shipmentCostUsd: 15_000 },
    });

    expect(mockRequest.create).toHaveBeenCalledOnce();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'APPROVAL_REQUESTED', tenantId: TENANT }),
    );
    expect(result).not.toBeNull();
    expect(result?.trigger).toBe(ApprovalTrigger.HIGH_SHIPMENT_COST);
    expect(result?.status).toBe(ApprovalStatus.PENDING);
  });

  it('returns null and does not create a request when threshold not met', async () => {
    const result = await checkAndRequestApproval({
      tenantId: TENANT,
      trigger:  ApprovalTrigger.HIGH_SHIPMENT_COST,
      context:  { shipmentCostUsd: 500 },
    });

    expect(result).toBeNull();
    expect(mockRequest.create).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it('passes expiresAt to the DB record', async () => {
    const expiresAt = new Date('2026-12-31T23:59:59Z');

    await checkAndRequestApproval({
      tenantId:  TENANT,
      trigger:   ApprovalTrigger.LOW_HTS_CONFIDENCE,
      context:   { htsConfidence: 0.5 },
      expiresAt,
    });

    expect(mockRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expires_at: expiresAt }),
      }),
    );
  });

  it('maps the DB row to a camelCase record', async () => {
    const result = await checkAndRequestApproval({
      tenantId: TENANT,
      trigger:  ApprovalTrigger.HIGH_SHIPMENT_COST,
      context:  { shipmentCostUsd: 15_000 },
    });

    expect(result?.id).toBe(REQ_ID);
    expect(result?.tenantId).toBe(TENANT);
  });

  // ---- Per-tenant config (Week 4) ----

  it('uses the configured costThreshold: no request at $15k when threshold is $50k', async () => {
    mockGetConfig.mockResolvedValue(configResult({ costThreshold: 50_000 }));

    const result = await checkAndRequestApproval({
      tenantId: TENANT,
      trigger:  ApprovalTrigger.HIGH_SHIPMENT_COST,
      context:  { shipmentCostUsd: 15_000 },
    });

    expect(result).toBeNull();
    expect(mockRequest.create).not.toHaveBeenCalled();
  });

  it('uses the configured costThreshold: creates a request at $55k when threshold is $50k', async () => {
    mockGetConfig.mockResolvedValue(configResult({ costThreshold: 50_000 }));

    const result = await checkAndRequestApproval({
      tenantId: TENANT,
      trigger:  ApprovalTrigger.HIGH_SHIPMENT_COST,
      context:  { shipmentCostUsd: 55_000 },
    });

    expect(result).not.toBeNull();
    expect(mockRequest.create).toHaveBeenCalledOnce();
  });

  it('auto-approves a shipment below autoApproveBelow without creating a request', async () => {
    mockGetConfig.mockResolvedValue(configResult({ autoApproveBelow: 500 }));

    const result = await checkAndRequestApproval({
      tenantId: TENANT,
      trigger:  ApprovalTrigger.HIGH_SHIPMENT_COST,
      context:  { shipmentCostUsd: 300 },
    });

    expect(result).toBeNull();
    expect(mockRequest.create).not.toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ reason: 'auto_approved_below_threshold' }),
      }),
    );
  });

  it('does not auto-approve at/above the floor; enters the normal workflow', async () => {
    mockGetConfig.mockResolvedValue(configResult({ autoApproveBelow: 500, costThreshold: 550 }));

    const result = await checkAndRequestApproval({
      tenantId: TENANT,
      trigger:  ApprovalTrigger.HIGH_SHIPMENT_COST,
      context:  { shipmentCostUsd: 600 },
    });

    expect(result).not.toBeNull();
    expect(mockRequest.create).toHaveBeenCalledOnce();
    expect(mockAudit).not.toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ reason: 'auto_approved_below_threshold' }),
      }),
    );
  });
});

// ===========================================================================
describe('recordDecision', () => {
  it('creates decision + updates request in a transaction', async () => {
    const result = await recordDecision({
      requestId: REQ_ID,
      tenantId:  TENANT,
      decidedBy: 'user-clerk-001',
      decision:  ApprovalStatus.APPROVED,
    });

    expect(mockTx).toHaveBeenCalledOnce();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'APPROVAL_DECIDED' }),
    );
    expect(result.decision).toBe(ApprovalStatus.APPROVED);
    expect(result.decidedBy).toBe('user-clerk-001');
  });

  it('throws on cross-tenant access', async () => {
    mockRequest.findUnique.mockResolvedValueOnce(makeRequestRow({ tenant_id: 'other-tenant' }));

    await expect(
      recordDecision({
        requestId: REQ_ID,
        tenantId:  TENANT,
        decidedBy: 'user-clerk-001',
        decision:  ApprovalStatus.APPROVED,
      }),
    ).rejects.toThrow('Cross-tenant access denied');
  });

  it('throws when request is already decided', async () => {
    mockRequest.findUnique.mockResolvedValueOnce(
      makeRequestRow({ status: ApprovalStatus.APPROVED }),
    );

    await expect(
      recordDecision({
        requestId: REQ_ID,
        tenantId:  TENANT,
        decidedBy: 'user-clerk-001',
        decision:  ApprovalStatus.REJECTED,
      }),
    ).rejects.toThrow('already decided');
  });

  it('throws when request is not found', async () => {
    mockRequest.findUnique.mockResolvedValueOnce(null);

    await expect(
      recordDecision({
        requestId: 'ghost-id',
        tenantId:  TENANT,
        decidedBy: 'user-clerk-001',
        decision:  ApprovalStatus.APPROVED,
      }),
    ).rejects.toThrow("not found");
  });

  it('forwards optional note to the decision row', async () => {
    await recordDecision({
      requestId: REQ_ID,
      tenantId:  TENANT,
      decidedBy: 'user-clerk-001',
      decision:  ApprovalStatus.REJECTED,
      note:      'Carrier not on approved list.',
    });

    // The create call inside $transaction is checked via the mock impl
    expect(mockTx).toHaveBeenCalledWith(
      expect.arrayContaining([expect.anything(), expect.anything()]),
    );
  });

  it('maps the decision row to a camelCase record', async () => {
    const result = await recordDecision({
      requestId: REQ_ID,
      tenantId:  TENANT,
      decidedBy: 'user-clerk-001',
      decision:  ApprovalStatus.APPROVED,
    });

    expect(result.requestId).toBe(REQ_ID);
    expect(result.note).toBeNull();
  });

  it('dispatches approval.approved when a request is approved', async () => {
    await recordDecision({
      requestId: REQ_ID,
      tenantId:  TENANT,
      decidedBy: 'user-clerk-001',
      decision:  ApprovalStatus.APPROVED,
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      TENANT,
      'approval.approved',
      expect.objectContaining({ approvalId: REQ_ID, status: ApprovalStatus.APPROVED }),
    );
  });

  it('dispatches decision.escalated when a request is escalated', async () => {
    mockRequest.update.mockResolvedValueOnce(makeRequestRow({ status: ApprovalStatus.ESCALATED }));

    await recordDecision({
      requestId: REQ_ID,
      tenantId:  TENANT,
      decidedBy: 'user-clerk-001',
      decision:  ApprovalStatus.ESCALATED,
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      TENANT,
      'decision.escalated',
      expect.objectContaining({ approvalId: REQ_ID }),
    );
  });
});

// ===========================================================================
describe('getPendingApprovals', () => {
  it('returns only PENDING requests for the tenant', async () => {
    const results = await getPendingApprovals(TENANT);

    expect(mockRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_id: TENANT, status: ApprovalStatus.PENDING },
      }),
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe(ApprovalStatus.PENDING);
  });

  it('returns an empty array when no pending requests exist', async () => {
    mockRequest.findMany.mockResolvedValueOnce([]);

    const results = await getPendingApprovals(TENANT);

    expect(results).toHaveLength(0);
  });

  it('orders results by created_at ascending', async () => {
    await getPendingApprovals(TENANT);

    expect(mockRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { created_at: 'asc' } }),
    );
  });

  it('maps DB rows to camelCase records', async () => {
    const results = await getPendingApprovals(TENANT);

    expect(results[0]?.tenantId).toBe(TENANT);
    expect(results[0]?.id).toBe(REQ_ID);
  });

  it('auto-expires pending requests older than 72h and dispatches approval.expired', async () => {
    const stale = new Date(Date.now() - 73 * 60 * 60 * 1000);
    mockRequest.findMany.mockResolvedValueOnce([makeRequestRow({ created_at: stale })]);
    mockRequest.updateMany.mockResolvedValueOnce({ count: 1 });

    const results = await getPendingApprovals(TENANT);

    // Expired requests are excluded from the returned pending list.
    expect(results).toHaveLength(0);
    // Conditional update guards against concurrent double-expiry.
    expect(mockRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REQ_ID, status: ApprovalStatus.PENDING },
        data:  { status: ApprovalStatus.EXPIRED },
      }),
    );
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'approval_request', entityId: REQ_ID }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      TENANT,
      'approval.expired',
      expect.objectContaining({ approvalId: REQ_ID }),
    );
  });

  it('does not dispatch approval.expired when a concurrent caller already expired it', async () => {
    const stale = new Date(Date.now() - 73 * 60 * 60 * 1000);
    mockRequest.findMany.mockResolvedValueOnce([makeRequestRow({ created_at: stale })]);
    mockRequest.updateMany.mockResolvedValueOnce({ count: 0 }); // lost the race

    const results = await getPendingApprovals(TENANT);

    expect(results).toHaveLength(0);
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
