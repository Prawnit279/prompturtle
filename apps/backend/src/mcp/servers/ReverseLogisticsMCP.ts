import { randomUUID } from 'crypto';

import type { InputJsonValue } from '@prisma/client/runtime/library';

import { AuditAction, ApprovalTrigger } from '@prompturtle/shared';
import type {
  BolType,
  ReturnCarrierOption,
  ReturnEligibilityResult,
  ReturnLineItem,
  ReturnRecord,
  ReturnRequestResult,
  ReturnStatus,
  ReturnUrgency,
} from '@prompturtle/shared';

import { checkAndRequestApproval } from '../../lib/approval.js';
import { writeAuditEvent } from '../../lib/audit.js';
import { prisma } from '../../lib/db.js';
import { getGuardrailConfig } from '../../lib/guardrail-config.js';
import logger from '../../lib/logger.js';
import { BaseMCPServer } from '../BaseMCPServer.js';
import type { ToolCallContext, ToolCallResult, ToolDefinition } from '../types.js';
import {
  CreateReturnInput as CreateReturnInputSchema,
  ReturnEligibilityInput as ReturnEligibilityInputSchema,
  RmaLookupInput as RmaLookupInputSchema,
  RouteReturnInput as RouteReturnInputSchema,
  registerReverseLogisticsSchemas,
  type CreateReturnInput,
  type ReturnEligibilityInput,
  type RouteReturnInput,
} from './schemas/reverse-logistics.schemas.js';

const AUDIT_MODULE = 'REVERSE_LOGISTICS';

// Business-rule constants.
const ORDER_CANCELLED_MAX_VALUE = 50_000; // ORDER_CANCELLED eligible only if value < this
const INSURANCE_VALUE_THRESHOLD = 10_000; // declaredValue above this adds the surcharge
const INSURANCE_SURCHARGE_PCT = 0.15;
const WEIGHT_COST_PER_LB = 0.05;
const AIR_WAYBILL_MIN_VALUE = 5_000; // expedited returns above this go by air

// Hardcoded return-carrier matrix (no external carrier APIs). baseCost is USD.
const RETURN_CARRIERS: Record<ReturnUrgency, ReadonlyArray<{ carrier: string; serviceLevel: string; estimatedDays: number; baseCost: number }>> = {
  standard: [
    { carrier: 'UPS',   serviceLevel: 'Ground',       estimatedDays: 5, baseCost: 25 },
    { carrier: 'FedEx', serviceLevel: 'Ground',       estimatedDays: 5, baseCost: 24 },
    { carrier: 'XPO',   serviceLevel: 'LTL Standard', estimatedDays: 7, baseCost: 45 },
  ],
  expedited: [
    { carrier: 'UPS',   serviceLevel: '2nd Day Air',   estimatedDays: 2, baseCost: 85 },
    { carrier: 'FedEx', serviceLevel: 'Express Saver',  estimatedDays: 2, baseCost: 80 },
  ],
  critical: [
    { carrier: 'FedEx', serviceLevel: 'Priority Overnight', estimatedDays: 1, baseCost: 195 },
    { carrier: 'UPS',   serviceLevel: 'Next Day Air',       estimatedDays: 1, baseCost: 185 },
  ],
};

const BOL_TYPE_CODE: Record<BolType, string> = {
  TRUCK_BOL:   'TRK',
  AIR_WAYBILL: 'AWB',
  OCEAN_BOL:   'OCN',
};

/** A typed Error carrying an HTTP status the global error handler can use. */
function httpError(statusCode: number, message: string): Error {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function yyyymmdd(date = new Date()): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

/** Derive a stable uppercase alphanumeric slug from the tenant name (or id). */
function tenantSlug(name: string | null | undefined, tenantId: string): string {
  const base = name && name.trim().length > 0 ? name : tenantId;
  const slug = base.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return slug.length > 0 ? slug.slice(0, 12) : 'TENANT';
}

/** RMA-{SLUG}-{YYYYMMDD}-{NNNN}, sequence = today's count for this tenant + 1. */
async function generateRmaNumber(tenantId: string, slug: string): Promise<string> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const count = await prisma.returnRequest.count({
    where: { tenant_id: tenantId, created_at: { gte: todayStart } },
  });
  return `RMA-${slug}-${yyyymmdd()}-${String(count + 1).padStart(4, '0')}`;
}

/** Internally generated return BOL number (the BOL processor has no generator). */
function generateReturnBolNumber(bolType: BolType): string {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `RBOL-${BOL_TYPE_CODE[bolType]}-${yyyymmdd()}-${suffix}`;
}

/** Infer the return BOL document type from urgency + value (per spec mapping). */
function bolTypeForUrgency(urgency: ReturnUrgency, declaredValue: number): BolType {
  if (urgency === 'expedited' && declaredValue > AIR_WAYBILL_MIN_VALUE) return 'AIR_WAYBILL';
  return 'TRUCK_BOL';
}

/** Minimal shape needed for weight-based cost — accepts Zod-parsed line items too. */
type WeighedItem = { quantity: number; weight?: number | undefined };

/** Total weight = sum(per-unit weight × quantity) across line items. */
function totalWeight(items: ReadonlyArray<WeighedItem> | undefined): number {
  if (!items) return 0;
  return items.reduce((sum, item) => sum + (item.weight ?? 0) * item.quantity, 0);
}

/** Deterministic carrier options for an urgency tier, lowest cost recommended. */
function computeCarrierOptions(declaredValue: number, urgency: ReturnUrgency, items?: ReadonlyArray<WeighedItem>): ReturnCarrierOption[] {
  const weight = totalWeight(items);
  const priced = RETURN_CARRIERS[urgency].map((c) => {
    const withWeight = c.baseCost + weight * WEIGHT_COST_PER_LB;
    const cost = declaredValue > INSURANCE_VALUE_THRESHOLD ? withWeight * (1 + INSURANCE_SURCHARGE_PCT) : withWeight;
    return { ...c, estimatedCost: round2(cost) };
  });

  const minCost = Math.min(...priced.map((p) => p.estimatedCost));
  const recommendedIdx = priced.findIndex((p) => p.estimatedCost === minCost);

  return priced.map((p, i) => ({
    carrier:       p.carrier,
    serviceLevel:  p.serviceLevel,
    estimatedDays: p.estimatedDays,
    estimatedCost: p.estimatedCost,
    currency:      'USD',
    recommended:   i === recommendedIdx,
  }));
}

/**
 * Pure eligibility evaluation. Rules checked in order; returns on first failure.
 * `costThreshold` drives the requiresApproval flag for otherwise-eligible returns.
 */
function evaluateEligibility(input: ReturnEligibilityInput, costThreshold: number): ReturnEligibilityResult {
  // 1. declaredValue must be > 0
  if (input.declaredValue <= 0) {
    return { eligible: false, reason: 'declaredValue must be greater than 0', requiresApproval: false };
  }

  // 2. at least one line item with quantity > 0
  if (!input.items.some((item) => item.quantity > 0)) {
    return { eligible: false, reason: 'At least one line item with quantity greater than 0 is required', requiresApproval: false };
  }

  // 3. returnReason validity is enforced by the Zod schema before this runs.

  // 4. ORDER_CANCELLED capped — freight contracts disallow large cancellations here
  if (input.returnReason === 'ORDER_CANCELLED' && input.declaredValue >= ORDER_CANCELLED_MAX_VALUE) {
    return {
      eligible: false,
      reason: `ORDER_CANCELLED returns are limited to declared values under $${ORDER_CANCELLED_MAX_VALUE.toLocaleString()}; route large cancellations through your account manager`,
      requiresApproval: false,
    };
  }

  // 5. eligible — flag approval when value exceeds the tenant's cost threshold
  const requiresApproval = input.declaredValue > costThreshold;
  return {
    eligible: true,
    requiresApproval,
    ...(requiresApproval
      ? { approvalNote: `Return value exceeds $${costThreshold.toLocaleString()} threshold — finance_manager approval required` }
      : {}),
  };
}

interface ReturnRow {
  id: string;
  rma_number: string;
  status: string;
  return_reason: string;
  original_bol_number: string | null;
  items: unknown;
  declared_value: number;
  currency: string;
  urgency: string;
  return_carrier: string | null;
  return_bol_number: string | null;
  approval_id: string | null;
  created_at: Date;
  updated_at: Date;
}

function toReturnRecord(row: ReturnRow): ReturnRecord {
  return {
    rmaNumber:    row.rma_number,
    status:       row.status as ReturnStatus,
    returnReason: row.return_reason as ReturnRecord['returnReason'],
    items:        row.items as ReturnLineItem[],
    declaredValue: row.declared_value,
    currency:     row.currency,
    urgency:      row.urgency as ReturnUrgency,
    createdAt:    row.created_at.toISOString(),
    updatedAt:    row.updated_at.toISOString(),
    ...(row.original_bol_number ? { originalBolNumber: row.original_bol_number } : {}),
    ...(row.return_carrier ? { returnCarrier: row.return_carrier } : {}),
    ...(row.return_bol_number ? { returnBolNumber: row.return_bol_number } : {}),
    ...(row.approval_id ? { approvalId: row.approval_id } : {}),
  };
}

export class ReverseLogisticsMCP extends BaseMCPServer {
  readonly name    = 'reverse-logistics';
  readonly version = '1.0.0';

  readonly tools: ToolDefinition[] = [
    {
      name: 'create_return',
      description:
        'Create a return: validate eligibility, generate an RMA number, generate a return BOL, present carrier ' +
        'options, and trigger approval for high-value returns. Persists a ReturnRequest and writes an audit event.',
      inputSchema: {
        type: 'object',
        properties: {
          originalBolNumber:  { type: 'string' },
          returnReason:       { type: 'string', enum: ['DAMAGED_IN_TRANSIT', 'WRONG_ITEM_SHIPPED', 'QUALITY_ISSUE', 'ORDER_CANCELLED', 'EXCESS_INVENTORY', 'SPECIFICATION_MISMATCH'] },
          items:              { type: 'array', items: { type: 'object' } },
          declaredValue:      { type: 'number' },
          currency:           { type: 'string' },
          urgency:            { type: 'string', enum: ['standard', 'expedited', 'critical'] },
          originAddress:      { type: 'object' },
          destinationAddress: { type: 'object' },
        },
        required: ['returnReason', 'items', 'declaredValue', 'originAddress', 'destinationAddress'],
      },
    },
    {
      name: 'validate_return_eligibility',
      description:
        'Check whether a return is eligible without persisting anything. Returns eligible, an optional reason, ' +
        'and whether the declared value requires finance approval.',
      inputSchema: {
        type: 'object',
        properties: {
          originalBolNumber: { type: 'string' },
          returnReason:      { type: 'string' },
          declaredValue:     { type: 'number' },
          items:             { type: 'array', items: { type: 'object' } },
        },
        required: ['returnReason', 'declaredValue', 'items'],
      },
    },
    {
      name: 'route_return',
      description: 'Return 2–3 carrier options for a return based on urgency, weight, and declared value. Lowest cost is recommended.',
      inputSchema: {
        type: 'object',
        properties: {
          declaredValue: { type: 'number' },
          urgency:       { type: 'string', enum: ['standard', 'expedited', 'critical'] },
          items:         { type: 'array', items: { type: 'object' } },
        },
        required: ['declaredValue'],
      },
    },
    {
      name: 'get_return_status',
      description: 'Fetch a return by its RMA number (tenant-scoped). 404 if not found.',
      inputSchema: { type: 'object', properties: { rmaNumber: { type: 'string' } }, required: ['rmaNumber'] },
    },
    {
      name: 'cancel_return',
      description: 'Cancel a return. Allowed only from INITIATED or APPROVED status.',
      inputSchema: { type: 'object', properties: { rmaNumber: { type: 'string' } }, required: ['rmaNumber'] },
    },
  ];

  constructor() {
    super();
    registerReverseLogisticsSchemas();
  }

  async executeTool(toolName: string, input: unknown, ctx: ToolCallContext): Promise<ToolCallResult> {
    this.assertToolExists(toolName);
    const log = logger.child({ tool: toolName, tenantId: ctx.tenantId });
    log.info('reverse-logistics.tool.start');

    switch (toolName) {
      case 'create_return':                return this.createReturn(input, ctx);
      case 'validate_return_eligibility':  return this.validateEligibility(input, ctx);
      case 'route_return':                 return this.routeReturn(input);
      case 'get_return_status':            return this.getReturnStatus(input, ctx);
      case 'cancel_return':                return this.cancelReturn(input, ctx);
      default:                             throw new Error(`Unhandled tool: ${toolName}`);
    }
  }

  private async validateEligibility(input: unknown, ctx: ToolCallContext): Promise<ToolCallResult> {
    const parsed = ReturnEligibilityInputSchema.parse(input);
    const config = await getGuardrailConfig(ctx.tenantId);
    return { success: true, data: evaluateEligibility(parsed, config.costThreshold) };
  }

  private routeReturn(input: unknown): ToolCallResult {
    const parsed: RouteReturnInput = RouteReturnInputSchema.parse(input);
    const options = computeCarrierOptions(parsed.declaredValue, parsed.urgency ?? 'standard', parsed.items);
    return { success: true, data: { carrierOptions: options } };
  }

  private async createReturn(input: unknown, ctx: ToolCallContext): Promise<ToolCallResult> {
    const parsed: CreateReturnInput = CreateReturnInputSchema.parse(input);
    const config = await getGuardrailConfig(ctx.tenantId);

    // 1. Eligibility gate — throw before any write if not eligible.
    const eligibility = evaluateEligibility(
      { returnReason: parsed.returnReason, declaredValue: parsed.declaredValue, items: parsed.items, ...(parsed.originalBolNumber ? { originalBolNumber: parsed.originalBolNumber } : {}) },
      config.costThreshold,
    );
    if (!eligibility.eligible) {
      throw httpError(422, eligibility.reason ?? 'Return is not eligible');
    }

    const urgency = parsed.urgency ?? 'standard';
    const currency = parsed.currency ?? 'USD';

    // 2. Approval for high-value returns (maps to the HIGH_SHIPMENT_COST trigger).
    let approvalId: string | undefined;
    if (eligibility.requiresApproval) {
      const approval = await checkAndRequestApproval({
        tenantId: ctx.tenantId,
        trigger:  ApprovalTrigger.HIGH_SHIPMENT_COST,
        context:  { shipmentCostUsd: parsed.declaredValue, source: 'reverse_logistics', returnReason: parsed.returnReason },
      });
      approvalId = approval?.id;
    }

    // 3. RMA number (tenant + day scoped sequence).
    const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true } });
    const slug = tenantSlug(tenant?.name, ctx.tenantId);
    const rmaNumber = await generateRmaNumber(ctx.tenantId, slug);

    // 4. Return BOL number (generated internally — no BOL-processor generation tool exists).
    const bolType = bolTypeForUrgency(urgency, parsed.declaredValue);
    const returnBolNumber = generateReturnBolNumber(bolType);

    // 5. Carrier options.
    const carrierOptions = computeCarrierOptions(parsed.declaredValue, urgency, parsed.items);

    // 6. Persist (status INITIATED even when approved — approval is a separate gate).
    const created = await prisma.returnRequest.create({
      data: {
        tenant_id:           ctx.tenantId,
        rma_number:          rmaNumber,
        status:              'INITIATED',
        return_reason:       parsed.returnReason,
        items:               parsed.items as unknown as InputJsonValue,
        declared_value:      parsed.declaredValue,
        currency,
        urgency,
        return_bol_number:   returnBolNumber,
        ...(parsed.originalBolNumber ? { original_bol_number: parsed.originalBolNumber } : {}),
        ...(approvalId ? { approval_id: approvalId } : {}),
      },
    });

    // 7. Audit trail.
    const auditId = randomUUID();
    await writeAuditEvent({
      tenantId:   ctx.tenantId,
      action:     AuditAction.TOOL_CALL,
      entityType: 'return_request',
      entityId:   created.id,
      payload: {
        module: AUDIT_MODULE,
        auditId,
        rmaNumber,
        returnReason:     parsed.returnReason,
        declaredValue:    parsed.declaredValue,
        currency,
        urgency,
        bolType,
        returnBolNumber,
        requiresApproval: eligibility.requiresApproval,
        approvalId:       approvalId ?? null,
        originAddress:    parsed.originAddress,
        destinationAddress: parsed.destinationAddress,
      },
    });

    const result: ReturnRequestResult = {
      rmaNumber,
      status:           created.status as ReturnStatus,
      returnBolNumber,
      requiresApproval: eligibility.requiresApproval,
      carrierOptions,
      auditId,
      createdAt:        created.created_at.toISOString(),
      ...(approvalId ? { approvalId } : {}),
    };

    return { success: true, data: result };
  }

  private async getReturnStatus(input: unknown, ctx: ToolCallContext): Promise<ToolCallResult> {
    const { rmaNumber } = RmaLookupInputSchema.parse(input);
    const row = await prisma.returnRequest.findFirst({
      where: { rma_number: rmaNumber, tenant_id: ctx.tenantId },
    });
    if (!row) {
      throw httpError(404, `Return '${rmaNumber}' not found`);
    }
    return { success: true, data: toReturnRecord(row as ReturnRow) };
  }

  private async cancelReturn(input: unknown, ctx: ToolCallContext): Promise<ToolCallResult> {
    const { rmaNumber } = RmaLookupInputSchema.parse(input);
    const row = await prisma.returnRequest.findFirst({
      where: { rma_number: rmaNumber, tenant_id: ctx.tenantId },
    });
    if (!row) {
      throw httpError(404, `Return '${rmaNumber}' not found`);
    }
    if (row.status !== 'INITIATED' && row.status !== 'APPROVED') {
      throw httpError(409, `Return '${rmaNumber}' cannot be cancelled from status ${row.status}`);
    }

    const updated = await prisma.returnRequest.update({
      where: { id: row.id },
      data:  { status: 'CANCELLED' },
    });

    await writeAuditEvent({
      tenantId:   ctx.tenantId,
      action:     AuditAction.UPDATE,
      entityType: 'return_request',
      entityId:   row.id,
      payload:    { module: AUDIT_MODULE, action: 'cancel_return', rmaNumber, previousStatus: row.status },
    });

    return { success: true, data: toReturnRecord(updated as ReturnRow) };
  }
}
