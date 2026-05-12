// AuditAction uses a string enum (per spec).

export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  TOOL_CALL = 'TOOL_CALL',
  AUTH_EVENT = 'AUTH_EVENT',
  GUARDRAIL_VIOLATION = 'GUARDRAIL_VIOLATION',
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  userId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
