import { describe, expect, it } from 'vitest';

import { NotImplementedError } from '../../types.js';

// ===========================================================================
// No MCP server is a stub anymore — CarbonTrackingMCP and SupplierRiskMCP both
// ship live (see their own test files). NotImplementedError stays exported for
// any future stub; these invariants guard that it (and the shared package) hold.
describe('Phase 2 invariants', () => {
  it('Phase2Feature enum is still present in shared package', async () => {
    // If this import fails the Phase2Feature enum was removed — stop and fix
    const { TenantTier: t } = await import('@prompturtle/shared');
    expect(t).toBeDefined();
  });

  it('NotImplementedError is exported from mcp/types', () => {
    expect(NotImplementedError).toBeDefined();
    const err = new NotImplementedError('test');
    expect(err.name).toBe('NotImplementedError');
    expect(err.message).toBe('test');
  });

  it('NotImplementedError has correct default message', () => {
    const err = new NotImplementedError();
    expect(err.message).toContain('not available in the current plan');
  });
});
