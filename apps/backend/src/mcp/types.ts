import type { TenantTier } from '@prompturtle/shared';

/** Context injected into every tool call by the auth middleware */
export interface ToolCallContext {
  tenantId: string;
  userId: string;
  tier: TenantTier;
  mcpServer: string;
  requestId: string;
}

/** What every MCP tool must return */
export interface ToolCallResult {
  success: boolean;
  data: unknown;
  meta?: {
    tokensUsed?: number;
    latencyMs?: number;
    model?: string;
  };
}

/** Schema describing a single tool exposed by an MCP server */
export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the input */
  inputSchema: Record<string, unknown>;
}

/** Error thrown when a call is rejected by the guardrail engine (stub for PR 2.4) */
export class GuardrailViolationError extends Error {
  constructor(
    public readonly rule: string,
    public readonly tenantId: string,
    message: string,
  ) {
    super(message);
    this.name = 'GuardrailViolationError';
  }
}

// TierLimitExceededError lives in lib/cost-tracker.ts (authoritative, with limitType/current/max).
// Import it from there — not from this file.
// Re-exported via mcp/index.ts for convenience.

/** Thrown by stub MCP servers for features not yet implemented */
export class NotImplementedError extends Error {
  constructor(message = 'This feature is not available in the current plan. See roadmap.') {
    super(message);
    this.name = 'NotImplementedError';
  }
}
