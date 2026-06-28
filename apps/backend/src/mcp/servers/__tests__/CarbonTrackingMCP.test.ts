import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantTier } from '@prompturtle/shared';
import type {
  CarbonCalculationResult,
  CarbonReport,
  EmissionFactorEntry,
  RouteComparisonResult,
} from '@prompturtle/shared';

import type { ToolCallContext } from '../../types.js';

// ---- Mocks ----
vi.mock('../../../lib/audit.js', () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
  queryAuditLog:   vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../lib/logger.js', () => ({
  default: {
    info: vi.fn(), error: vi.fn(), warn: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

vi.mock('../../../guardrails/rules/InputSchemaRule.js', () => ({
  InputSchemaRule:    class InputSchemaRule { check = vi.fn().mockResolvedValue(null); },
  registerToolSchema: vi.fn(),
}));

import { queryAuditLog, writeAuditEvent } from '../../../lib/audit.js';
import { CarbonTrackingMCP } from '../CarbonTrackingMCP.js';

const mockAudit = writeAuditEvent as ReturnType<typeof vi.fn>;
const mockQuery = queryAuditLog as ReturnType<typeof vi.fn>;

function makeCtx(overrides: Partial<ToolCallContext> = {}): ToolCallContext {
  return { tenantId: 'tenant-test', userId: 'user-test', tier: TenantTier.GROWTH, mcpServer: 'carbon-tracking', requestId: 'req-test', ...overrides };
}

let server: CarbonTrackingMCP;
beforeEach(() => {
  vi.clearAllMocks();
  mockQuery.mockResolvedValue([]);
  server = new CarbonTrackingMCP();
});

async function calc(input: Record<string, unknown>): Promise<CarbonCalculationResult> {
  const res = await server.executeTool('calculate_footprint', input, makeCtx());
  return res.data as CarbonCalculationResult;
}

// ===========================================================================
describe('CarbonTrackingMCP — metadata', () => {
  it('is live (not a stub) with four tools', () => {
    expect(server.name).toBe('carbon-tracking');
    expect(server.version).toBe('1.0.0');
    expect(server.tools.map((t) => t.name)).toEqual([
      'calculate_footprint', 'get_emission_factors', 'compare_routes', 'generate_report',
    ]);
  });

  it('throws for an unknown tool', async () => {
    await expect(server.executeTool('ghost', {}, makeCtx())).rejects.toThrow("Tool 'ghost' not found");
  });
});

describe('calculate_footprint — exact math', () => {
  it('TRUCK 10,000 kg × 500 km = 480 kg CO2e', async () => {
    const d = await calc({ mode: 'TRUCK', weightKg: 10000, distanceKm: 500 });
    expect(d.co2eKg).toBe(480);
    expect(d.distanceEstimated).toBe(false);
    expect(d.emissionFactor).toBe(0.096);
  });

  it('AIR 500 kg × 8,000 km = 2408 kg CO2e', async () => {
    const d = await calc({ mode: 'AIR', weightKg: 500, distanceKm: 8000 });
    expect(d.co2eKg).toBe(2408);
    expect(d.methodology).toMatch(/ICAO/);
  });

  it('OCEAN 50,000 kg × 20,000 km = 16000 kg CO2e', async () => {
    const d = await calc({ mode: 'OCEAN', weightKg: 50000, distanceKm: 20000 });
    expect(d.co2eKg).toBe(16000);
    expect(d.co2eTonnes).toBe(16);
  });
});

describe('calculate_footprint — CBAM scope', () => {
  it("['720810'] → in scope (iron/steel chapter 72)", async () => {
    const d = await calc({ mode: 'OCEAN', weightKg: 1000, distanceKm: 100, hsCodes: ['720810'] });
    expect(d.cbam.inScope).toBe(true);
    expect(d.cbam.matchedCodes).toEqual(['720810']);
    expect(d.cbam.reportingNote).toMatch(/CBAM/);
  });

  it("['252301'] → in scope (cement prefix 2523)", async () => {
    const d = await calc({ mode: 'TRUCK', weightKg: 1000, distanceKm: 100, hsCodes: ['252301'] });
    expect(d.cbam.inScope).toBe(true);
  });

  it("['61091000'] → not in scope (apparel)", async () => {
    const d = await calc({ mode: 'TRUCK', weightKg: 1000, distanceKm: 100, hsCodes: ['61091000'] });
    expect(d.cbam.inScope).toBe(false);
    expect(d.cbam.matchedCodes).toEqual([]);
    expect(d.cbam.reportingNote).toBeUndefined();
  });

  it('[] / omitted → not in scope', async () => {
    const d = await calc({ mode: 'TRUCK', weightKg: 1000, distanceKm: 100 });
    expect(d.cbam.inScope).toBe(false);
  });
});

describe('calculate_footprint — distance estimation', () => {
  it('US → DE is estimated within a sane band', async () => {
    const d = await calc({ mode: 'OCEAN', weightKg: 1000, originCountryCode: 'US', destinationCountryCode: 'DE' });
    expect(d.distanceEstimated).toBe(true);
    expect(d.distanceKm).toBeGreaterThan(5000);
    expect(d.distanceKm).toBeLessThan(10000);
  });

  it('unknown country pair falls back to 5000 km', async () => {
    const d = await calc({ mode: 'TRUCK', weightKg: 1000, originCountryCode: 'XX', destinationCountryCode: 'YY' });
    expect(d.distanceKm).toBe(5000);
    expect(d.distanceEstimated).toBe(true);
  });
});

describe('calculate_footprint — audit', () => {
  it('writes an audit record with module CARBON_TRACKING', async () => {
    await calc({ mode: 'TRUCK', weightKg: 1000, distanceKm: 100 });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'carbon_footprint', payload: expect.objectContaining({ module: 'CARBON_TRACKING' }) }),
    );
  });
});

describe('get_emission_factors', () => {
  it('returns all five GLEC 3.0 factors with sources', async () => {
    const res = await server.executeTool('get_emission_factors', {}, makeCtx());
    const factors = (res.data as { factors: EmissionFactorEntry[] }).factors;
    expect(factors).toHaveLength(5);
    const truck = factors.find((f) => f.mode === 'TRUCK');
    expect(truck?.factor).toBe(0.096);
    expect(truck?.glecVersion).toBe('3.0');
    expect(factors.every((f) => f.source.length > 0)).toBe(true);
  });
});

describe('compare_routes', () => {
  it('TRUCK vs AIR: TRUCK is lowest, ~84% reduction vs AIR', async () => {
    const res = await server.executeTool(
      'compare_routes',
      { weightKg: 10000, distanceKm: 1000, routes: [{ label: 'Truck', mode: 'TRUCK' }, { label: 'Air', mode: 'AIR' }] },
      makeCtx(),
    );
    const d = res.data as RouteComparisonResult;
    const truck = d.routes.find((r) => r.mode === 'TRUCK');
    const air = d.routes.find((r) => r.mode === 'AIR');
    expect(air!.co2eKg).toBeGreaterThan(truck!.co2eKg);
    expect(truck!.isLowest).toBe(true);
    expect(air!.isLowest).toBe(false);
    expect(truck!.reductionVsHighest).toBe(84);
    expect(d.lowestEmissionRoute).toBe('Truck');
    expect(d.highestEmissionRoute).toBe('Air');
  });
});

describe('generate_report', () => {
  it('aggregates carbon_footprint audit events by mode', async () => {
    mockQuery.mockResolvedValue([
      { payload: { co2eKg: 480, transportMode: 'TRUCK', cbamInScope: false } },
      { payload: { co2eKg: 2408, transportMode: 'AIR', cbamInScope: true } },
      { payload: { co2eKg: 16000, transportMode: 'OCEAN', cbamInScope: true } },
      { payload: { foo: 'malformed' } }, // skipped — no parseable footprint
    ]);
    const res = await server.executeTool('generate_report', { from: '2026-06-01', to: '2026-06-30' }, makeCtx());
    const d = res.data as CarbonReport;
    expect(d.totalShipments).toBe(3);
    expect(d.totalCo2eKg).toBe(18888);
    expect(d.byMode.TRUCK.shipments).toBe(1);
    expect(d.byMode.AIR.co2eKg).toBe(2408);
    expect(d.cbamRelevantShipments).toBe(2);
    expect(d.methodology).toBe('GLEC Framework 3.0');
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'carbon_report' }));
  });

  it('returns zeros when there are no footprint events', async () => {
    const res = await server.executeTool('generate_report', { from: '2026-06-01', to: '2026-06-30' }, makeCtx());
    const d = res.data as CarbonReport;
    expect(d.totalShipments).toBe(0);
    expect(d.totalCo2eKg).toBe(0);
  });
});
