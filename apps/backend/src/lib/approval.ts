import type { InputJsonValue } from '@prisma/client/runtime/library';

import { AuditAction, ApprovalStatus, ApprovalTrigger } from '@prompturtle/shared';

import { prisma } from './db.js';
import logger from './logger.js';
import { writeAuditEvent } from './audit.js';

// ---- Boundary conditions for trigger evaluation ----
const THRESHOLDS = {
  HIGH_SHIPMENT_COST_USD: 10_000,
  LOW_HTS_CONFIDENCE:     0.7,
} as const;

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
 * Pure function — no I/O.
 */
export function evaluateTrigger(
  trigger: ApprovalTrigger,
  context: TriggerContext,
): boolean {
  switch (trigger) {
    case ApprovalTrigger.HIGH_SHIPMENT_COST:
      return (context.shipmentCostUsd ?? 0) > THRESHOLDS.HIGH_SHIPMENT_COST_USD;

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

  if (!evaluateTrigger(trigger, context)) {
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

  return mapDecision(decisionRow);
}

/**
 * Returns all PENDING approval requests for a tenant, ordered oldest-first.
 */
export async function getPendingApprovals(
  tenantId: string,
): Promise<ApprovalRequestRecord[]> {
  const rows = await prisma.approvalRequest.findMany({
    where:   { tenant_id: tenantId, status: ApprovalStatus.PENDING },
    orderBy: { created_at: 'asc' },
  });

  return rows.map(mapRequest);
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
