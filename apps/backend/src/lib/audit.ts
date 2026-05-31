import type { InputJsonValue, JsonValue } from '@prisma/client/runtime/library';

import type { AuditAction } from '@prompturtle/shared';

import { prisma } from './db.js';
import logger from './logger.js';

export interface AuditEventRecord {
  id: string;
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditQueryFilters {
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

/**
 * Write a single audit event. Never throws — DB failure is logged and swallowed
 * so a logging error never crashes the caller's request.
 */
export async function writeAuditEvent(event: {
  tenantId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        tenant_id:   event.tenantId,
        action:      event.action,
        entity_type: event.entityType,
        entity_id:   event.entityId,
        // Prisma Json field requires explicit cast from Record<string, unknown>
        payload:     event.payload as InputJsonValue,
      },
    });
  } catch (err) {
    logger.error({ err, event }, 'audit.write.failed');
  }
}

/**
 * Query audit log for a tenant. Always scoped to tenantId — never cross-tenant.
 */
export async function queryAuditLog(
  tenantId: string,
  filters: AuditQueryFilters = {},
): Promise<AuditEventRecord[]> {
  const events = await prisma.auditEvent.findMany({
    where: {
      tenant_id: tenantId,
      ...(filters.action && { action: filters.action }),
      ...(filters.entityType && { entity_type: filters.entityType }),
      ...(filters.entityId && { entity_id: filters.entityId }),
      ...(filters.from ?? filters.to
        ? {
            created_at: {
              ...(filters.from && { gte: filters.from }),
              ...(filters.to && { lte: filters.to }),
            },
          }
        : {}),
    },
    orderBy: { created_at: 'desc' },
    take: filters.limit ?? 100,
  });

  type AuditEventRow = { id: string; tenant_id: string; action: string; entity_type: string; entity_id: string; payload: JsonValue; created_at: Date };
  return events.map((e: AuditEventRow) => ({
    id:         e.id,
    tenantId:   e.tenant_id,
    action:     e.action,
    entityType: e.entity_type,
    entityId:   e.entity_id,
    payload:    e.payload as Record<string, unknown>,
    createdAt:  e.created_at,
  }));
}
