import { AuditAction } from '@prompturtle/shared';

import { writeAuditEvent } from '../lib/audit.js';
import { dispatch } from '../lib/webhook-service.js';
import logger from '../lib/logger.js';
import { GuardrailViolationError } from '../mcp/types.js';
import type { ToolCallContext } from '../mcp/types.js';

import type { BaseRule } from './rules/BaseRule.js';
import { InputSchemaRule } from './rules/InputSchemaRule.js';
import { RateLimitRule } from './rules/RateLimitRule.js';
import { TenantScopeRule } from './rules/TenantScopeRule.js';

export class GuardrailEngine {
  private readonly rules: BaseRule[];

  constructor(rules?: BaseRule[]) {
    this.rules = rules ?? [
      new RateLimitRule(),
      new InputSchemaRule(),
      new TenantScopeRule(),
    ];
  }

  /**
   * Run all rules against the incoming call context.
   * First violation found → audit log written → GuardrailViolationError thrown.
   * All rules pass → returns void.
   */
  async enforce(ctx: ToolCallContext, toolName: string, input: unknown): Promise<void> {
    for (const rule of this.rules) {
      const violation = await rule.check(toolName, input, ctx);

      if (violation) {
        logger.warn(
          {
            rule:      violation.rule,
            tenantId:  ctx.tenantId,
            toolName,
            payload:   violation.payload,
          },
          'guardrail.violation',
        );

        await writeAuditEvent({
          tenantId:   ctx.tenantId,
          action:     AuditAction.GUARDRAIL_VIOLATION,
          entityType: 'tool_call',
          entityId:   `${ctx.mcpServer}:${toolName}`,
          payload:    {
            rule:    violation.rule,
            message: violation.message,
            ...violation.payload,
          },
        });

        // A guardrail violation is a halted decision — notify subscribers after
        // the audit write. Fire-and-forget: must not block or break the request.
        void dispatch(ctx.tenantId, 'decision.halted', {
          rule:      violation.rule,
          message:   violation.message,
          mcpServer: ctx.mcpServer,
          toolName,
          ...violation.payload,
        });

        throw new GuardrailViolationError(
          violation.rule,
          ctx.tenantId,
          violation.message,
        );
      }
    }
  }
}

/** Singleton used by BaseMCPServer */
export const guardrailEngine = new GuardrailEngine();
