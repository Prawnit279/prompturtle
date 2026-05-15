import { z } from 'zod';

import type { ToolCallContext } from '../../mcp/types.js';

import { BaseRule, type RuleViolation } from './BaseRule.js';

/** Registry of tool input schemas — populated at server startup by each MCP server */
const toolSchemas = new Map<string, z.ZodTypeAny>();

/** Register a Zod schema for a specific tool. Key format: `serverName:toolName` */
export function registerToolSchema(
  serverName: string,
  toolName: string,
  schema: z.ZodTypeAny,
): void {
  toolSchemas.set(`${serverName}:${toolName}`, schema);
}

/**
 * Validates tool input against its registered Zod schema.
 * If no schema is registered for the tool, the rule passes (opt-in validation).
 */
export class InputSchemaRule extends BaseRule {
  readonly name = 'InputSchemaRule';

  async check(
    toolName: string,
    input: unknown,
    ctx: ToolCallContext,
  ): Promise<RuleViolation | null> {
    const key = `${ctx.mcpServer}:${toolName}`;
    const schema = toolSchemas.get(key);

    if (!schema) {
      // No schema registered — pass through
      return null;
    }

    const result = schema.safeParse(input);
    if (!result.success) {
      return {
        rule:    this.name,
        message: `Input validation failed for ${key}`,
        payload: {
          tool:   key,
          errors: result.error.flatten(),
        },
      };
    }

    return null;
  }
}
