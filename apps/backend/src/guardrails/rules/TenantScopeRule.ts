import type { ToolCallContext } from '../../mcp/types.js';

import { BaseRule, type RuleViolation } from './BaseRule.js';

/**
 * Blocks any tool input that contains entity IDs belonging to a different tenant.
 *
 * Strategy: scan string values in the input object for fields named *tenantId*
 * (case-insensitive). If a value differs from the caller's tenantId, reject.
 *
 * This is a best-effort guardrail — full entity-level enforcement happens via RLS.
 * This rule catches accidental cross-tenant lookups before they hit the DB.
 */
export class TenantScopeRule extends BaseRule {
  readonly name = 'TenantScopeRule';

  async check(
    toolName: string,
    input: unknown,
    ctx: ToolCallContext,
  ): Promise<RuleViolation | null> {
    if (input === null || typeof input !== 'object') {
      return null;
    }

    const suspiciousFields = this.findCrossTenantRefs(
      input as Record<string, unknown>,
      ctx.tenantId,
    );

    if (suspiciousFields.length > 0) {
      return {
        rule:    this.name,
        message: `Input contains references that do not match caller tenant ${ctx.tenantId}`,
        payload: {
          toolName,
          suspiciousFields,
          callerTenantId: ctx.tenantId,
        },
      };
    }

    return null;
  }

  /**
   * Recursively scan object for fields named *tenantId* (case-insensitive)
   * whose value is a non-empty string that differs from the caller's tenant.
   */
  private findCrossTenantRefs(
    obj: Record<string, unknown>,
    callerTenantId: string,
    path = '',
  ): string[] {
    const violations: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;

      if (
        /tenantId/i.test(key) &&
        typeof value === 'string' &&
        value.length > 0 &&
        value !== callerTenantId
      ) {
        violations.push(`${fieldPath}="${value}" (expected "${callerTenantId}")`);
      }

      if (Array.isArray(value)) {
        // Scan array elements for nested tenant refs (e.g. bulk-lookup inputs)
        for (let i = 0; i < value.length; i++) {
          const item = value[i];
          if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
            violations.push(
              ...this.findCrossTenantRefs(
                item as Record<string, unknown>,
                callerTenantId,
                `${fieldPath}[${i}]`,
              ),
            );
          }
        }
      } else if (value !== null && typeof value === 'object') {
        violations.push(
          ...this.findCrossTenantRefs(
            value as Record<string, unknown>,
            callerTenantId,
            fieldPath,
          ),
        );
      }
    }

    return violations;
  }
}
