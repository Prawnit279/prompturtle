export interface ApiKey {
  id:         string;
  name:       string;
  prefix:     string;
  createdAt:  string;
  lastUsedAt: string | null;
  raw?:       string; // only present on creation response — shown once
}

export interface ToolCallLog {
  id:           string;
  mcpServer:    string;
  toolName:     string;
  model:        string;
  inputTokens:  number;
  outputTokens: number;
  costUsd:      number;
  durationMs:   number;
  status:       'SUCCESS' | 'ERROR' | 'WARNING' | 'PENDING';
  createdAt:    string;
}

export interface UsageByServer {
  server:       string;
  calls:        number;
  costUsd:      number;
  inputTokens:  number;
  outputTokens: number;
}

export interface UsageResponse {
  days:         number;
  totalCostUsd: number;
  totalCalls:   number;
  byServer:     UsageByServer[];
}

export interface LogsResponse {
  calls:  ToolCallLog[];
  total:  number;
  page:   number;
  limit:  number;
  pages:  number;
}

// ---- Webhooks ----

export type WebhookEventType =
  | 'approval.approved'
  | 'approval.rejected'
  | 'approval.expired'
  | 'decision.halted'
  | 'decision.escalated'
  | 'usage.threshold_reached';

export const WEBHOOK_EVENTS: readonly WebhookEventType[] = [
  'approval.approved',
  'approval.rejected',
  'approval.expired',
  'decision.halted',
  'decision.escalated',
  'usage.threshold_reached',
];

export interface WebhookLastDelivery {
  success:     boolean;
  statusCode?: number;
  createdAt:   string;
}

export interface Webhook {
  id:           string;
  url:          string;
  events:       WebhookEventType[];
  description?: string;
  isActive:     boolean;
  createdAt:    string;
  secret?:      string; // only present in the creation response
  lastDelivery?: WebhookLastDelivery;
}

export interface WebhookDelivery {
  id:           string;
  webhookId:    string;
  event:        string;
  statusCode?:  number;
  success:      boolean;
  attemptCount: number;
  deliveredAt?: string;
  createdAt:    string;
}

export interface WebhookDeliveriesResponse {
  deliveries: WebhookDelivery[];
  total:      number;
  page:       number;
  limit:      number;
  pages:      number;
}

// ---- Guardrail configuration ----

export interface GuardrailConfig {
  id:                  string;
  tenantId:            string;
  costThreshold:       number;
  approvedCarriers:    string[];
  requireBrokerVerify: boolean;
  autoApproveBelow:    number;
  updatedAt:           string;
  isDefault?:          boolean;
}
