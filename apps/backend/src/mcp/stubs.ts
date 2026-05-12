import type { TenantTier } from '@prompturtle/shared';

import type { ToolCallContext } from './types.js';

/**
 * Cost tracker stub — replaced by PR 2.3 (lib/cost-tracker.ts).
 * Today it's a pass-through that records nothing.
 */
export async function trackedCall<T>(
  _options: {
    tenantId: string;
    mcpServer: string;
    toolName: string;
    tier: TenantTier;
  },
  fn: () => Promise<T>,
): Promise<T> {
  return fn();
}

/**
 * Guardrail engine stub — replaced by PR 2.4 (guardrails/GuardrailEngine.ts).
 * Today it's a no-op that allows all calls.
 */
export async function enforceGuardrails(
  _ctx: ToolCallContext,
): Promise<void> {
  // no-op until PR 2.4
}
