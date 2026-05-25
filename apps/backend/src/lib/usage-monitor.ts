/**
 * Usage monitor — fires an 80% threshold warning email once per crossing.
 * Called fire-and-forget from cost-tracker after each successful tool call.
 */
import { TenantTier, TIER_LIMITS } from '@prompturtle/shared';

import { prisma } from './db.js';
import { sendUsageWarningEmail } from './email.js';
import logger from './logger.js';

const WARNING_THRESHOLD = 0.8; // 80%

/**
 * Check if this call just crossed the 80% usage threshold and send a warning email.
 * callsAfter = the new total after the call that was just recorded.
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

    const percentUsed  = Math.round((callsAfter / callLimit) * 100);
    const callsBefore  = callsAfter - 1;
    const wasBelow80   = callsBefore < callLimit * WARNING_THRESHOLD;
    const isAtOrAbove80 = callsAfter >= callLimit * WARNING_THRESHOLD;

    // Only fire on the exact threshold crossing — not on every call above 80%
    if (!isAtOrAbove80 || !wasBelow80) return;

    const tenant = await prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { email: true, name: true },
    });

    if (!tenant?.email) {
      logger.info({ tenantId }, 'usage-monitor.no_email');
      return;
    }

    await sendUsageWarningEmail({
      to:          tenant.email,
      tenantName:  tenant.name,
      tier,
      callsUsed:   callsAfter,
      callLimit,
      percentUsed,
    });

    logger.info({ tenantId, percentUsed }, 'usage-monitor.warning_sent');
  } catch (err) {
    logger.error({ err, tenantId }, 'usage-monitor.check_failed');
  }
}
