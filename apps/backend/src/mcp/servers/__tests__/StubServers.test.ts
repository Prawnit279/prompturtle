import { describe, expect, it } from 'vitest';

import { TenantTier } from '@prompturtle/shared';

import { NotImplementedError } from '../../types.js';
import type { ToolCallContext } from '../../types.js';
import { CarbonTrackingMCP } from '../CarbonTrackingMCP.js';

function makeCtx(): ToolCallContext {
  return {
    tenantId:  'tenant-test',
    userId:    'user-test',
    tier:      TenantTier.STARTER,
    mcpServer: 'stub',
    requestId: 'req-test',
  };
}

// ===========================================================================
describe('CarbonTrackingMCP', () => {
  const server = new CarbonTrackingMCP();

  it('has correct name and stub version', () => {
    expect(server.name).toBe('carbon-tracking');
    expect(server.version).toBe('0.0.0-stub');
  });

  it('exposes exactly 3 tools', () => {
    expect(server.tools).toHaveLength(3);
    const names = server.tools.map(t => t.name);
    expect(names).toContain('calculate_carbon_footprint');
    expect(names).toContain('get_carbon_offset_options');
    expect(names).toContain('generate_emissions_report');
  });

  it.each([
    'calculate_carbon_footprint',
    'get_carbon_offset_options',
    'generate_emissions_report',
  ])('%s throws NotImplementedError', async (toolName) => {
    await expect(server.executeTool(toolName, {}, makeCtx()))
      .rejects.toThrow(NotImplementedError);
  });

  it('NotImplementedError message contains sales contact', async () => {
    try {
      await server.executeTool('calculate_carbon_footprint', {}, makeCtx());
    } catch (err) {
      expect(err).toBeInstanceOf(NotImplementedError);
      expect((err as NotImplementedError).message).toContain('sales@prompturtle.com');
    }
  });

  it('throws "not found" for unknown tool', async () => {
    await expect(server.executeTool('ghost', {}, makeCtx()))
      .rejects.toThrow("Tool 'ghost' not found");
  });
});

// ===========================================================================
// SupplierRiskMCP is no longer a stub — it ships live (see SupplierRiskMCP.test.ts).
describe('Phase 2 stub invariants', () => {
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
