/**
 * Usage monitor — fires an 80% threshold warning email and dispatches
 * `usage.threshold_reached` webhooks at the 80% and 100% crossings.
 * Called fire-and-forget from cost-tracker after each successful tool call.
 */
import { TenantTier, TIER_LIMITS } from '@prompturtle/shared';

import { prisma } from './db.js';
import { sendUsageWarningEmail } from './email.js';
import logger from './logger.js';
import { dispatch } from './webhook-service.js';

const WARNING_THRESHOLD = 0.8; // 80%
const LIMIT_THRESHOLD   = 1.0; // 100%

/** True only on the call where the running total first reaches `fraction × limit`. */
function justCrossed(callsBefore: number, callsAfter: number, limit: number, fraction: number): boolean {
  const boundary = limit * fraction;
  return callsBefore < boundary && callsAfter >= boundary;
}

/**
 * Check whether this call just crossed the 80% or 100% usage thresholds.
 * - 80% crossing: sends a warning email AND dispatches usage.threshold_reached (80).
 * - 100% crossing: dispatches usage.threshold_reached (100).
 *
 * callsAfter = the new total after the call that was just recorded. The
 * crossing math is inherently idempotent — each threshold fires once per
 * billing period — so no persisted notified-flag is required.
 * Non-fatal — never throws; logs errors internally.
 */
export async function checkAndWarnUsage(
  tenantId: string,
  tier: TenantTier,
  callsAfter: number,
): Promise<void> {
  try {
    const limits    = TIER_LIMITS[tier];
    const callLimit = limits.callsPerMonth;

    // No cap for unlimited tiers (Enterprise if ever set to 0 — guard for future)
    if (callLimit <= 0) return;

    const percentUsed = Math.round((callsAfter / callLimit) * 100);
    const callsBefore = callsAfter - 1;

    const crossed80  = justCrossed(callsBefore, callsAfter, callLimit, WARNING_THRESHOLD);
    const crossed100 = justCrossed(callsBefore, callsAfter, callLimit, LIMIT_THRESHOLD);

    if (!crossed80 && !crossed100) return;

    if (crossed80) {
      void dispatch(tenantId, 'usage.threshold_reached', {
        threshold: 80,
        callsUsed: callsAfter,
        callLimit,
        percentUsed,
        tier,
      });

      const tenant = await prisma.tenant.findUnique({
        where:  { id: tenantId },
        select: { email: true, name: true },
      });

      if (tenant?.email) {
        await sendUsageWarningEmail({
          to:         tenant.email,
          tenantName: tenant.name,
          tier,
          callsUsed:  callsAfter,
          callLimit,
          percentUsed,
        });
        logger.info({ tenantId, percentUsed }, 'usage-monitor.warning_sent');
      } else {
        logger.info({ tenantId }, 'usage-monitor.no_email');
      }
    }

    if (crossed100) {
      void dispatch(tenantId, 'usage.threshold_reached', {
        threshold: 100,
        callsUsed: callsAfter,
        callLimit,
        percentUsed,
        tier,
      });
      logger.info({ tenantId, percentUsed }, 'usage-monitor.limit_reached');
    }
  } catch (err) {
    logger.error({ err, tenantId }, 'usage-monitor.check_failed');
  }
}
