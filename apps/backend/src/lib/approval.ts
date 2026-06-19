import { randomUUID } from 'crypto';

import type { InputJsonValue } from '@prisma/client/runtime/library';

import { AuditAction, ApprovalStatus, ApprovalTrigger } from '@prompturtle/shared';
import type { WebhookEventType } from '@prompturtle/shared';

import { prisma } from './db.js';
import logger from './logger.js';
import { writeAuditEvent } from './audit.js';
import { getGuardrailConfig } from './guardrail-config.js';
import { dispatch } from './webhook-service.js';

// ---- Boundary conditions for trigger evaluation ----
// HIGH_SHIPMENT_COST_USD is the platform default; the per-tenant
// GuardrailConfig.costThreshold overrides it at evaluation time.
const THRESHOLDS = {
  HIGH_SHIPMENT_COST_USD: 10_000,
  LOW_HTS_CONFIDENCE:     0.7,
} as const;

/** A pending approval auto-expires once it is older than this. */
const APPROVAL_EXPIRY_MS = 72 * 60 * 60 * 1000; // 72 hours

/** Maps a recorded decision onto the outbound webhook event it fires. */
const DECISION_EVENT: Record<
  ApprovalStatus.APPROVED | ApprovalStatus.REJECTED | ApprovalStatus.ESCALATED,
  WebhookEventType
> = {
  [ApprovalStatus.APPROVED]:  'approval.approved',
  [ApprovalStatus.REJECTED]:  'approval.rejected',
  [ApprovalStatus.ESCALATED]: 'decision.escalated',
};

// ---- Public interfaces ----

export interface ApprovalRequestRecord {
  id:        string;
  tenantId:  string;
  trigger:   ApprovalTrigger;
  status:    ApprovalStatus;
  context:   Record<string, unknown>;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalDecisionRecord {
  id:        string;
  requestId: string;
  decidedBy: string;
  decision:  ApprovalStatus;
  note:      string | null;
  decidedAt: Date;
}

export interface TriggerContext {
  shipmentCostUsd?: number;
  htsConfidence?:   number;
  previousCarrier?: string;
  newCarrier?:      string;
  [key: string]: unknown;
}

// ---- Trigger evaluation ----

/**
 * Returns true if the provided context exceeds the threshold for the given trigger.
 * Pure function — no I/O. `costThresholdUsd` overrides the platform default for
 * the HIGH_SHIPMENT_COST trigger (sourced from the tenant's GuardrailConfig).
 */
export function evaluateTrigger(
  trigger: ApprovalTrigger,
  context: TriggerContext,
  costThresholdUsd: number = THRESHOLDS.HIGH_SHIPMENT_COST_USD,
): boolean {
  switch (trigger) {
    case ApprovalTrigger.HIGH_SHIPMENT_COST:
      return (context.shipmentCostUsd ?? 0) > costThresholdUsd;

    case ApprovalTrigger.LOW_HTS_CONFIDENCE:
      return (context.htsConfidence ?? 1) < THRESHOLDS.LOW_HTS_CONFIDENCE;

    case ApprovalTrigger.CARRIER_CHANGE_ON_PO:
      return (
        typeof context.previousCarrier === 'string' &&
        typeof context.newCarrier === 'string' &&
        context.previousCarrier !== context.newCarrier
      );
  }
}

// ---- Core operations ----

/**
 * Evaluates whether a trigger condition is met; if so, creates an ApprovalRequest
 * and writes an APPROVAL_REQUESTED audit event.
 *
 * Returns the new request record when approval is required, or null when the
 * trigger threshold is not met.
 */
export async function checkAndRequestApproval(params: {
  tenantId:  string;
  trigger:   ApprovalTrigger;
  context:   TriggerContext;
  expiresAt?: Date;
}): Promise<ApprovalRequestRecord | null> {
  const { tenantId, trigger, context, expiresAt } = params;

  const config = await getGuardrailConfig(tenantId);

  // Auto-approve short-circuit: shipments below the configured floor skip the
  // human approval queue entirely. Still audited. Disabled when autoApproveBelow
  // is 0 (the default). Only applies to cost-bearing contexts.
  const cost = context.shipmentCostUsd;
  if (config.autoApproveBelow > 0 && typeof cost === 'number' && cost < config.autoApproveBelow) {
    await writeAuditEvent({
      tenantId,
      action:     AuditAction.APPROVAL_DECIDED,
      entityType: 'approval_request',
      entityId:   randomUUID(),
      payload: {
        decision:         ApprovalStatus.APPROVED,
        reason:           'auto_approved_below_threshold',
        trigger,
        shipmentCostUsd:  cost,
        autoApproveBelow: config.autoApproveBelow,
      },
    });
    logger.info(
      { tenantId, trigger, cost, autoApproveBelow: config.autoApproveBelow },
      'approval.auto_approved',
    );
    return null;
  }

  if (!evaluateTrigger(trigger, context, config.costThreshold)) {
    return null;
  }

  const request = await prisma.approvalRequest.create({
    data: {
      tenant_id:  tenantId,
      trigger,
      status:     ApprovalStatus.PENDING,
      context:    context as InputJsonValue,
      expires_at: expiresAt ?? null,
    },
  });

  await writeAuditEvent({
    tenantId,
    action:     AuditAction.APPROVAL_REQUESTED,
    entityType: 'approval_request',
    entityId:   request.id,
    payload:    { trigger, context },
  });

  logger.info({ tenantId, requestId: request.id, trigger }, 'approval.requested');

  return mapRequest(request);
}

/**
 * Records a human decision (APPROVED, REJECTED, ESCALATED) for a pending request.
 *
 * Guards:
 * - Cross-tenant: throws if the request belongs to a different tenant.
 * - Already-decided: throws if status is not PENDING.
 *
 * Uses a Prisma $transaction to atomically write the decision row and update the
 * request status.
 */
export async function recordDecision(params: {
  requestId:  string;
  tenantId:   string;   // caller's tenant — used for cross-tenant guard
  decidedBy:  string;   // Clerk user-id
  decision:   ApprovalStatus.APPROVED | ApprovalStatus.REJECTED | ApprovalStatus.ESCALATED;
  note?:      string;
}): Promise<ApprovalDecisionRecord> {
  const { requestId, tenantId, decidedBy, decision, note } = params;

  // Load the request for guard checks
  const existing = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
  });

  if (!existing) {
    throw new Error(`ApprovalRequest '${requestId}' not found`);
  }
  if (existing.tenant_id !== tenantId) {
    throw new Error(`Cross-tenant access denied for ApprovalRequest '${requestId}'`);
  }
  if (existing.status !== ApprovalStatus.PENDING) {
    throw new Error(
      `ApprovalRequest '${requestId}' already decided (status: ${existing.status})`,
    );
  }

  // Atomic: create decision + update status
  const [decisionRow] = await prisma.$transaction([
    prisma.approvalDecision.create({
      data: {
        request_id: requestId,
        decided_by: decidedBy,
        decision,
        note: note ?? null,
      },
    }),
    prisma.approvalRequest.update({
      where: { id: requestId },
      data:  { status: decision },
    }),
  ]);

  await writeAuditEvent({
    tenantId,
    action:     AuditAction.APPROVAL_DECIDED,
    entityType: 'approval_request',
    entityId:   requestId,
    payload:    { decidedBy, decision, note: note ?? null },
  });

  logger.info({ tenantId, requestId, decidedBy, decision }, 'approval.decided');

  // Fire the outbound webhook for this resolution — after the audit write, never
  // before. Fire-and-forget: dispatch never throws and must not block the caller.
  void dispatch(tenantId, DECISION_EVENT[decision], {
    approvalId: requestId,
    status:     decision,
    decidedBy,
    note:       note ?? null,
  });

  return mapDecision(decisionRow);
}

/**
 * Returns all PENDING approval requests for a tenant, ordered oldest-first.
 *
 * Side effect: any pending request older than 72 hours is lazily auto-expired
 * on read — its status is set to EXPIRED, an audit event is written, and an
 * `approval.expired` webhook is dispatched. Expired requests are excluded from
 * the returned list.
 */
export async function getPendingApprovals(
  tenantId: string,
): Promise<ApprovalRequestRecord[]> {
  const rows = await prisma.approvalRequest.findMany({
    where:   { tenant_id: tenantId, status: ApprovalStatus.PENDING },
    orderBy: { created_at: 'asc' },
  });

  const now = Date.now();
  const active: typeof rows = [];

  for (const row of rows) {
    if (now - row.created_at.getTime() > APPROVAL_EXPIRY_MS) {
      await expireRequest(tenantId, row.id, row.trigger as ApprovalTrigger);
    } else {
      active.push(row);
    }
  }

  return active.map(mapRequest);
}

/**
 * Marks one request EXPIRED, audits it, and dispatches `approval.expired`.
 *
 * The status transition is conditional (`updateMany ... where status=PENDING`)
 * so concurrent reads can't both expire the same request — only the call that
 * actually flips PENDING→EXPIRED audits and dispatches the webhook. This makes
 * the lazy-expiry side effect on getPendingApprovals idempotent.
 */
async function expireRequest(
  tenantId: string,
  requestId: string,
  trigger: ApprovalTrigger,
): Promise<void> {
  const { count } = await prisma.approvalRequest.updateMany({
    where: { id: requestId, status: ApprovalStatus.PENDING },
    data:  { status: ApprovalStatus.EXPIRED },
  });

  // Someone else already expired it — don't double-audit or double-dispatch.
  if (count === 0) return;

  await writeAuditEvent({
    tenantId,
    action:     AuditAction.APPROVAL_DECIDED,
    entityType: 'approval_request',
    entityId:   requestId,
    payload:    { decision: ApprovalStatus.EXPIRED, reason: 'auto_expired_72h' },
  });

  logger.info({ tenantId, requestId }, 'approval.expired');

  void dispatch(tenantId, 'approval.expired', {
    approvalId:        requestId,
    trigger,
    expiredAfterHours: 72,
  });
}

// ---- Private mappers ----

function mapRequest(
  r: Awaited<ReturnType<typeof prisma.approvalRequest.findUniqueOrThrow>>,
): ApprovalRequestRecord {
  return {
    id:        r.id,
    tenantId:  r.tenant_id,
    trigger:   r.trigger as ApprovalTrigger,
    status:    r.status as ApprovalStatus,
    context:   r.context as Record<string, unknown>,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapDecision(
  d: Awaited<ReturnType<typeof prisma.approvalDecision.create>>,
): ApprovalDecisionRecord {
  return {
    id:        d.id,
    requestId: d.request_id,
    decidedBy: d.decided_by,
    decision:  d.decision as ApprovalStatus,
    note:      d.note,
    decidedAt: d.decided_at,
  };
}
