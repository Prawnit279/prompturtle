import { TIER_LIMITS } from '@prompturtle/shared';

import { prisma } from '../../lib/db.js';
import type { ToolCallContext } from '../../mcp/types.js';

import { BaseRule, type RuleViolation } from './BaseRule.js';

/**
 * Enforces per-minute call rate limits by tier.
 * Mirrors the check in cost-tracker but happens BEFORE the call (guardrail = pre-flight).
 * Cost-tracker re-checks after — belt-and-suspenders.
 */
export class RateLimitRule extends BaseRule {
  readonly name = 'RateLimitRule';

  async check(
    _toolName: string,
    _input: unknown,
    ctx: ToolCallContext,
  ): Promise<RuleViolation | null> {
    const limits = TIER_LIMITS[ctx.tier];
    const oneMinuteAgo = new Date(Date.now() - 60_000);

    const callsThisMinute = await prisma.toolCall.count({
      where: {
        tenant_id:  ctx.tenantId,
        created_at: { gte: oneMinuteAgo },
      },
    });

    if (callsThisMinute >= limits.callsPerMinute) {
      return {
        rule:    this.name,
        message: `Rate limit exceeded: ${callsThisMinute}/${limits.callsPerMinute} calls/min for tier ${ctx.tier}`,
        payload: {
          callsThisMinute,
          limit: limits.callsPerMinute,
          tier:  ctx.tier,
        },
      };
    }

    return null;
  }
}
