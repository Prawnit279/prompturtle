import type { ToolCallContext } from '../../mcp/types.js';

export interface RuleViolation {
  rule: string;
  message: string;
  payload: Record<string, unknown>;
}

export abstract class BaseRule {
  abstract readonly name: string;

  /**
   * Return a RuleViolation if the rule is violated, null if it passes.
   * Never throw — violations are returned as values.
   */
  abstract check(
    toolName: string,
    input: unknown,
    ctx: ToolCallContext,
  ): Promise<RuleViolation | null>;
}
