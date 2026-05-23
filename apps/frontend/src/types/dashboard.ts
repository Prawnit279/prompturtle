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
