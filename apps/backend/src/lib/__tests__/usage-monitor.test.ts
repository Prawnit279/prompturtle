/**
 * Unit tests for the usage monitor — verifies the 80% and 100% threshold
 * crossings each fire a usage.threshold_reached webhook exactly once, and that
 * the 80% crossing also sends the warning email.
 *
 * STARTER tier: 10,000 calls/month → 80% boundary = 8,000, 100% boundary = 10,000.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantTier } from '@prompturtle/shared';

vi.mock('../db.js', () => ({
  prisma: {
    tenant: { findUnique: vi.fn().mockResolvedValue({ email: 'ops@vendor.example', name: 'Vendor' }) },
  },
}));

vi.mock('../email.js', () => ({
  sendUsageWarningEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn(() => ({ info: vi.fn() })) },
}));

vi.mock('../webhook-service.js', () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

import { checkAndWarnUsage } from '../usage-monitor.js';
import { sendUsageWarningEmail } from '../email.js';
import { dispatch } from '../webhook-service.js';

const mockEmail    = sendUsageWarningEmail as ReturnType<typeof vi.fn>;
const mockDispatch = dispatch as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkAndWarnUsage', () => {
  it('dispatches usage.threshold_reached(80) and emails on the 80% crossing', async () => {
    await checkAndWarnUsage('tenant-1', TenantTier.STARTER, 8_000);

    expect(mockDispatch).toHaveBeenCalledWith(
      'tenant-1',
      'usage.threshold_reached',
      expect.objectContaining({ threshold: 80 }),
    );
    expect(mockEmail).toHaveBeenCalledOnce();
  });

  it('dispatches usage.threshold_reached(100) on the 100% crossing', async () => {
    await checkAndWarnUsage('tenant-1', TenantTier.STARTER, 10_000);

    expect(mockDispatch).toHaveBeenCalledWith(
      'tenant-1',
      'usage.threshold_reached',
      expect.objectContaining({ threshold: 100 }),
    );
  });

  it('does nothing when the call is not on a threshold boundary', async () => {
    await checkAndWarnUsage('tenant-1', TenantTier.STARTER, 5_000);

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it('fires the 80% threshold only once, not on every call above 80%', async () => {
    await checkAndWarnUsage('tenant-1', TenantTier.STARTER, 8_001); // already past boundary

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('never enforces a usage threshold for ENTERPRISE (unlimited)', async () => {
    await checkAndWarnUsage('tenant-1', TenantTier.ENTERPRISE, 500_000);

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockEmail).not.toHaveBeenCalled();
  });
});
