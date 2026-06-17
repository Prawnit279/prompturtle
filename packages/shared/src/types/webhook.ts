/**
 * Outbound webhook types (Week 3).
 *
 * These are the wire/API shapes (camelCase), distinct from the snake_case
 * Prisma models. `test.ping` is a test-only event emitted by
 * POST /api/webhooks/:id/test — it is never produced by real system activity
 * and is excluded from the subscribable event list in the dashboard.
 */

export type WebhookEventType =
  | 'approval.approved'
  | 'approval.rejected'
  | 'approval.expired'
  | 'decision.halted'
  | 'decision.escalated'
  | 'usage.threshold_reached'
  | 'test.ping';

/** Event types a tenant can subscribe to (excludes the test-only ping). */
export const SUBSCRIBABLE_WEBHOOK_EVENTS: readonly WebhookEventType[] = [
  'approval.approved',
  'approval.rejected',
  'approval.expired',
  'decision.halted',
  'decision.escalated',
  'usage.threshold_reached',
] as const;

/** The JSON body POSTed to a registered endpoint. */
export interface WebhookPayload {
  id: string; // unique delivery ID (matches the WebhookDelivery record id)
  event: WebhookEventType;
  createdAt: string; // ISO 8601
  tenantId: string;
  data: Record<string, unknown>;
}

/** A registered endpoint, as returned by the API. `secret` only at creation. */
export interface WebhookRegistration {
  id: string;
  url: string;
  events: WebhookEventType[];
  description?: string;
  isActive: boolean;
  createdAt: string;
  secret?: string; // only returned by POST /api/webhooks
}

/** A single delivery attempt summary, as returned by the deliveries log. */
export interface WebhookDeliveryRecord {
  id: string;
  webhookId: string;
  event: WebhookEventType;
  statusCode?: number;
  success: boolean;
  attemptCount: number;
  deliveredAt?: string;
  createdAt: string;
}
