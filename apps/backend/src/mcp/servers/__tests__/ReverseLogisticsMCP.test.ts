import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalTrigger, TenantTier } from '@prompturtle/shared';
import type {
  ReturnCarrierOption,
  ReturnEligibilityResult,
  ReturnRecord,
  ReturnRequestResult,
} from '@prompturtle/shared';

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

vi.mock('../../../lib/guardrail-config.js', () => ({
  getGuardrailConfig: vi.fn(),
}));

vi.mock('../../../lib/approval.js', () => ({
  checkAndRequestApproval: vi.fn(),
}));

vi.mock('../../../lib/db.js', () => ({
  prisma: {
    tenant:        { findUnique: vi.fn() },
    returnRequest: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}));

import { writeAuditEvent } from '../../../lib/audit.js';
import { checkAndRequestApproval } from '../../../lib/approval.js';
import { getGuardrailConfig } from '../../../lib/guardrail-config.js';
import { prisma } from '../../../lib/db.js';
import { ReverseLogisticsMCP } from '../ReverseLogisticsMCP.js';

const mockAudit       = writeAuditEvent as ReturnType<typeof vi.fn>;
const mockApproval    = checkAndRequestApproval as ReturnType<typeof vi.fn>;
const mockGetConfig   = getGuardrailConfig as ReturnType<typeof vi.fn>;
const mockTenant      = prisma.tenant.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockCount       = prisma.returnRequest.count as unknown as ReturnType<typeof vi.fn>;
const mockCreate      = prisma.returnRequest.create as unknown as ReturnType<typeof vi.fn>;
const mockFindFirst   = prisma.returnRequest.findFirst as unknown as ReturnType<typeof vi.fn>;
const mockUpdate      = prisma.returnRequest.update as unknown as ReturnType<typeof vi.fn>;

function configResult(overrides: Record<string, unknown> = {}) {
  return {
    id: '', tenantId: 'tenant-test', costThreshold: 10000, approvedCarriers: [],
    requireBrokerVerify: true, autoApproveBelow: 0, updatedAt: '', ...overrides,
  };
}

function makeCtx(overrides: Partial<ToolCallContext> = {}): ToolCallContext {
  return { tenantId: 'tenant-test', userId: 'user-test', tier: TenantTier.GROWTH, mcpServer: 'reverse-logistics', requestId: 'req-test', ...overrides };
}

function addr(over: Record<string, unknown> = {}) {
  return { name: 'Acme Returns', street: '1 Main St', city: 'Denver', region: 'CO', postalCode: '80202', country: 'US', ...over };
}

function item(over: Record<string, unknown> = {}) {
  return { sku: 'SKU1', description: 'Widget', quantity: 2, unitValue: 50, weight: 3, ...over };
}

function createInput(over: Record<string, unknown> = {}) {
  return {
    returnReason: 'DAMAGED_IN_TRANSIT', items: [item()], declaredValue: 4500, urgency: 'standard',
    originAddress: addr(), destinationAddress: addr({ name: 'Warehouse' }), ...over,
  };
}

function returnRow(over: Record<string, unknown> = {}) {
  return {
    id: 'ret_1', rma_number: 'RMA-ACMELOGISTI-20260701-0001', status: 'INITIATED',
    return_reason: 'DAMAGED_IN_TRANSIT', original_bol_number: null,
    items: [{ sku: 'SKU1', description: 'Widget', quantity: 2, unitValue: 50 }],
    declared_value: 4500, currency: 'USD', urgency: 'standard',
    return_carrier: null, return_bol_number: 'RBOL-TRK-20260701-ABCD1234', approval_id: null,
    created_at: new Date('2026-07-01T00:00:00Z'), updated_at: new Date('2026-07-01T00:00:00Z'), ...over,
  };
}

let server: ReverseLogisticsMCP;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetConfig.mockResolvedValue(configResult());
  mockApproval.mockResolvedValue(null);
  mockTenant.mockResolvedValue({ name: 'Acme Logistics' });
  mockCount.mockResolvedValue(0);
  mockCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'ret_1', ...data, created_at: new Date('2026-07-01T00:00:00Z'), updated_at: new Date('2026-07-01T00:00:00Z') }),
  );
  server = new ReverseLogisticsMCP();
});

async function validate(input: Record<string, unknown>): Promise<ReturnEligibilityResult> {
  const res = await server.executeTool('validate_return_eligibility', input, makeCtx());
  return res.data as ReturnEligibilityResult;
}

async function create(over: Record<string, unknown> = {}): Promise<ReturnRequestResult> {
  const res = await server.executeTool('create_return', createInput(over), makeCtx());
  return res.data as ReturnRequestResult;
}

// ===========================================================================
describe('ReverseLogisticsMCP — metadata', () => {
  it('is live with the five tools', () => {
    expect(server.name).toBe('reverse-logistics');
    expect(server.version).toBe('1.0.0');
    expect(server.tools.map((t) => t.name)).toEqual([
      'create_return', 'validate_return_eligibility', 'route_return', 'get_return_status', 'cancel_return',
    ]);
  });
});

describe('validate_return_eligibility', () => {
  it('eligible for a standard return under threshold', async () => {
    const d = await validate({ returnReason: 'DAMAGED_IN_TRANSIT', declaredValue: 4500, items: [item()] });
    expect(d.eligible).toBe(true);
    expect(d.requiresApproval).toBe(false);
  });

  it('ineligible when the items array is empty', async () => {
    const d = await validate({ returnReason: 'DAMAGED_IN_TRANSIT', declaredValue: 100, items: [] });
    expect(d.eligible).toBe(false);
    expect(d.reason).toMatch(/line item/i);
  });

  it('ineligible for ORDER_CANCELLED above $50,000', async () => {
    const d = await validate({ returnReason: 'ORDER_CANCELLED', declaredValue: 60000, items: [item()] });
    expect(d.eligible).toBe(false);
    expect(d.reason).toMatch(/ORDER_CANCELLED/);
  });

  it('eligible but requiresApproval when value exceeds the guardrail threshold', async () => {
    const d = await validate({ returnReason: 'QUALITY_ISSUE', declaredValue: 15000, items: [item()] });
    expect(d.eligible).toBe(true);
    expect(d.requiresApproval).toBe(true);
    expect(d.approvalNote).toMatch(/threshold/);
  });
});

describe('create_return', () => {
  it('generates an RMA number in the RMA-{SLUG}-{YYYYMMDD}-{NNNN} format', async () => {
    const d = await create();
    expect(d.rmaNumber).toMatch(/^RMA-[A-Z0-9]+-\d{8}-\d{4}$/);
  });

  it('generates a return BOL number and persists the record', async () => {
    const d = await create();
    expect(d.returnBolNumber).toMatch(/^RBOL-/);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate.mock.calls[0]?.[0].data.return_bol_number).toBe(d.returnBolNumber);
  });

  it('returns 3 carrier options with exactly one recommended', async () => {
    const d = await create();
    expect(d.carrierOptions).toHaveLength(3);
    expect(d.carrierOptions?.filter((o) => o.recommended)).toHaveLength(1);
  });

  it('high-value return → approval requested, approvalId set, status INITIATED', async () => {
    mockApproval.mockResolvedValue({ id: 'appr_1' });
    const d = await create({ declaredValue: 15000 });
    expect(d.requiresApproval).toBe(true);
    expect(d.approvalId).toBe('appr_1');
    expect(d.status).toBe('INITIATED');
    expect(mockApproval).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: ApprovalTrigger.HIGH_SHIPMENT_COST, context: expect.objectContaining({ shipmentCostUsd: 15000 }) }),
    );
  });

  it('does not request approval for a value under threshold', async () => {
    const d = await create();
    expect(d.requiresApproval).toBe(false);
    expect(d.approvalId).toBeUndefined();
    expect(mockApproval).not.toHaveBeenCalled();
  });

  it('throws on ineligible input and writes no DB record', async () => {
    await expect(create({ returnReason: 'ORDER_CANCELLED', declaredValue: 60000 })).rejects.toThrow(/ORDER_CANCELLED/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('writes an audit record with module REVERSE_LOGISTICS on every call', async () => {
    await create();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'return_request', payload: expect.objectContaining({ module: 'REVERSE_LOGISTICS' }) }),
    );
  });
});

describe('get_return_status', () => {
  it('returns the full record when found', async () => {
    mockFindFirst.mockResolvedValue(returnRow());
    const res = await server.executeTool('get_return_status', { rmaNumber: 'RMA-ACMELOGISTI-20260701-0001' }, makeCtx());
    const d = res.data as ReturnRecord;
    expect(d.rmaNumber).toBe('RMA-ACMELOGISTI-20260701-0001');
    expect(d.status).toBe('INITIATED');
    expect(d.declaredValue).toBe(4500);
  });

  it("404s for another tenant's RMA (filtered to null by tenant scope)", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      server.executeTool('get_return_status', { rmaNumber: 'RMA-OTHER-20260701-0001' }, makeCtx()),
    ).rejects.toThrow(/not found/);
  });
});

describe('cancel_return', () => {
  it('cancels an INITIATED return', async () => {
    mockFindFirst.mockResolvedValue(returnRow({ status: 'INITIATED' }));
    mockUpdate.mockResolvedValue(returnRow({ status: 'CANCELLED' }));
    const res = await server.executeTool('cancel_return', { rmaNumber: 'RMA-ACMELOGISTI-20260701-0001' }, makeCtx());
    expect((res.data as ReturnRecord).status).toBe('CANCELLED');
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'return_request', payload: expect.objectContaining({ action: 'cancel_return' }) }),
    );
  });

  it('refuses to cancel an IN_TRANSIT return', async () => {
    mockFindFirst.mockResolvedValue(returnRow({ status: 'IN_TRANSIT' }));
    await expect(
      server.executeTool('cancel_return', { rmaNumber: 'RMA-ACMELOGISTI-20260701-0001' }, makeCtx()),
    ).rejects.toThrow(/cannot be cancelled/);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('route_return', () => {
  it('critical urgency lists FedEx Priority Overnight first', async () => {
    const res = await server.executeTool('route_return', { declaredValue: 1000, urgency: 'critical' }, makeCtx());
    const opts = (res.data as { carrierOptions: ReturnCarrierOption[] }).carrierOptions;
    expect(opts[0]?.carrier).toBe('FedEx');
    expect(opts[0]?.serviceLevel).toBe('Priority Overnight');
  });

  it('applies the 15% insurance surcharge above $10,000', async () => {
    const plain = await server.executeTool('route_return', { declaredValue: 1000, urgency: 'standard' }, makeCtx());
    const insured = await server.executeTool('route_return', { declaredValue: 20000, urgency: 'standard' }, makeCtx());
    const plainCost = (plain.data as { carrierOptions: ReturnCarrierOption[] }).carrierOptions[0]?.estimatedCost ?? 0;
    const insuredCost = (insured.data as { carrierOptions: ReturnCarrierOption[] }).carrierOptions[0]?.estimatedCost ?? 0;
    expect(insuredCost).toBeGreaterThan(plainCost);
  });
});
