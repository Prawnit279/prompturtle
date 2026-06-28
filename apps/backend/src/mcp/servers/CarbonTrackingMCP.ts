import { randomUUID } from 'crypto';

import { AuditAction } from '@prompturtle/shared';
import type {
  CarbonCalculationResult,
  CarbonCbamResult,
  CarbonReport,
  EmissionFactorEntry,
  RouteComparisonResult,
  RouteComparisonRoute,
  TransportMode,
} from '@prompturtle/shared';

import { queryAuditLog, writeAuditEvent } from '../../lib/audit.js';
import logger from '../../lib/logger.js';
import { BaseMCPServer } from '../BaseMCPServer.js';
import type { ToolCallContext, ToolCallResult, ToolDefinition } from '../types.js';
import {
  CalculateFootprintInput as CalculateFootprintInputSchema,
  CompareRoutesInput as CompareRoutesInputSchema,
  GenerateReportInput as GenerateReportInputSchema,
  registerCarbonSchemas,
  type CalculateFootprintInput,
  type CompareRoutesInput,
} from './schemas/carbon.schemas.js';

const AUDIT_MODULE = 'CARBON_TRACKING';
const GLEC_VERSION = '3.0' as const;

// ---------------------------------------------------------------------------
// GLEC Framework 3.0 (Global Logistics Emissions Council) — kg CO2e per
// tonne-km. Regulatory-grade constants; DO NOT alter. No external API.
// ---------------------------------------------------------------------------
const EMISSION_FACTORS: Record<TransportMode, number> = {
  TRUCK: 0.096, // EU average articulated truck (GLEC)
  AIR:   0.602, // ICAO Carbon Calculator methodology (ICAO)
  OCEAN: 0.016, // IMO GHG Study 4th edition (IMO)
  RAIL:  0.028, // EU average freight train (GLEC)
  BARGE: 0.031, // EU inland waterway (GLEC)
};

const FACTOR_SOURCE: Record<TransportMode, string> = {
  TRUCK: 'GLEC — EU articulated truck average',
  AIR:   'ICAO Carbon Calculator',
  OCEAN: 'IMO GHG Study 4th edition',
  RAIL:  'GLEC — EU freight train average',
  BARGE: 'GLEC — EU inland waterway average',
};

const METHODOLOGY: Record<TransportMode, string> = {
  TRUCK: 'GLEC Framework 3.0 — EU articulated truck average',
  AIR:   'GLEC Framework 3.0 — ICAO Carbon Calculator methodology',
  OCEAN: 'GLEC Framework 3.0 — IMO GHG Study 4th edition',
  RAIL:  'GLEC Framework 3.0 — EU freight train average',
  BARGE: 'GLEC Framework 3.0 — EU inland waterway average',
};

// EU CBAM-scope HS code prefixes (EU Regulation 2023/956, Annex I; in force Jan 2026).
const CBAM_HS_PREFIXES = ['2523', '2716', '2804', '3102', '3103', '3104', '3105'] as const;
// CBAM-scope HS chapters (first 2 digits): iron/steel, articles of iron/steel, aluminum.
const CBAM_HS_CHAPTERS = ['72', '73', '76'] as const;

const CBAM_REPORTING_NOTE =
  'CBAM reporting required for EU imports of these goods. EU Regulation 2023/956 in force January 2026.';

const DISTANCE_FALLBACK_KM = 5000;

// Country centroid lookup (lat, lon) — top trading nations. Used for great-circle
// distance estimation when an explicit distanceKm is not supplied.
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  US: [37.09, -95.71], CN: [35.86, 104.19], DE: [51.16, 10.45],
  GB: [55.37, -3.43], JP: [36.20, 138.25], KR: [35.90, 127.76],
  IN: [20.59, 78.96], SG: [1.35, 103.81], AU: [-25.27, 133.77],
  NL: [52.13, 5.29], FR: [46.22, 2.21], CA: [56.13, -106.34],
  IT: [41.87, 12.56], ES: [40.46, -3.74], MX: [23.63, -102.55],
  BR: [-14.23, -51.92], TH: [15.87, 100.99], VN: [14.05, 108.27],
  TR: [38.96, 35.24], PL: [51.91, 19.14], SE: [60.12, 18.64],
  BE: [50.50, 4.46], CH: [46.81, 8.22], MY: [4.21, 101.97],
  ID: [-0.78, 113.92], ZA: [-30.55, 22.93], AE: [23.42, 53.84],
  EG: [26.82, 30.80], NG: [9.08, 8.67], PK: [30.37, 69.34],
};

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance (Haversine) between two country centroids, in km. */
function estimateDistanceKm(originCC: string, destCC: string): number {
  const o = COUNTRY_CENTROIDS[originCC.toUpperCase()];
  const d = COUNTRY_CENTROIDS[destCC.toUpperCase()];
  if (!o || !d) return DISTANCE_FALLBACK_KM;
  const R = 6371; // Earth radius km
  const dLat = toRad(d[0] - o[0]);
  const dLon = toRad(d[1] - o[1]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(o[0])) * Math.cos(toRad(d[0])) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Tonnes from kg, rounded to 3 decimals to avoid float noise. */
function toTonnes(kg: number): number {
  return Math.round((kg / 1000) * 1000) / 1000;
}

/** Pure CO2e calculation: (weightKg/1000) × distanceKm × emissionFactor. */
function co2eForLeg(weightKg: number, distanceKm: number, mode: TransportMode): number {
  return round2((weightKg / 1000) * distanceKm * EMISSION_FACTORS[mode]);
}

function checkCbam(hsCodes: string[] | undefined): CarbonCbamResult {
  const codes = hsCodes ?? [];
  const matchedCodes = codes.filter(
    (hs) => CBAM_HS_PREFIXES.some((p) => hs.startsWith(p)) || CBAM_HS_CHAPTERS.some((ch) => hs.startsWith(ch)),
  );
  const inScope = matchedCodes.length > 0;
  return { inScope, matchedCodes, ...(inScope ? { reportingNote: CBAM_REPORTING_NOTE } : {}) };
}

/** The five GLEC 3.0 emission factors as a reference list (also used by the public route). */
export function emissionFactorList(): EmissionFactorEntry[] {
  return (Object.keys(EMISSION_FACTORS) as TransportMode[]).map((mode) => ({
    mode,
    factor:      EMISSION_FACTORS[mode],
    source:      FACTOR_SOURCE[mode],
    glecVersion: GLEC_VERSION,
  }));
}

export class CarbonTrackingMCP extends BaseMCPServer {
  readonly name    = 'carbon-tracking';
  readonly version = '1.0.0';

  readonly tools: ToolDefinition[] = [
    {
      name: 'calculate_footprint',
      description:
        'Calculate shipment CO2e from weight × distance × GLEC Framework 3.0 emission factor. Estimates distance ' +
        'from country centroids when not supplied, and flags CBAM scope by HS code. Deterministic; audited.',
      inputSchema: {
        type: 'object',
        properties: {
          mode:                   { type: 'string', enum: ['TRUCK', 'AIR', 'OCEAN', 'RAIL', 'BARGE'] },
          weightKg:               { type: 'number' },
          distanceKm:             { type: 'number' },
          originCity:             { type: 'string' },
          originCountryCode:      { type: 'string' },
          destinationCity:        { type: 'string' },
          destinationCountryCode: { type: 'string' },
          hsCodes:                { type: 'array', items: { type: 'string' } },
          bolNumber:              { type: 'string' },
        },
        required: ['mode', 'weightKg'],
      },
    },
    {
      name: 'get_emission_factors',
      description: 'Reference: the five GLEC Framework 3.0 emission factors (kg CO2e/tonne-km), their sources, and the GLEC version.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'compare_routes',
      description: 'Compare transport modes for the same shipment by CO2e. Flags the lowest-emission option and the % reduction vs the highest.',
      inputSchema: {
        type: 'object',
        properties: {
          weightKg:   { type: 'number' },
          distanceKm: { type: 'number' },
          routes:     { type: 'array', items: { type: 'object' } },
          hsCodes:    { type: 'array', items: { type: 'string' } },
        },
        required: ['weightKg', 'distanceKm', 'routes'],
      },
    },
    {
      name: 'generate_report',
      description: 'Aggregate calculate_footprint results from the audit trail over a date range into a structured carbon report.',
      inputSchema: {
        type: 'object',
        properties: { from: { type: 'string' }, to: { type: 'string' } },
        required: ['from', 'to'],
      },
    },
  ];

  constructor() {
    super();
    registerCarbonSchemas();
  }

  async executeTool(toolName: string, input: unknown, ctx: ToolCallContext): Promise<ToolCallResult> {
    this.assertToolExists(toolName);
    const log = logger.child({ tool: toolName, tenantId: ctx.tenantId });
    log.info('carbon.tool.start');

    switch (toolName) {
      case 'calculate_footprint':   return this.calculateFootprint(input, ctx);
      case 'get_emission_factors':  return { success: true, data: { factors: emissionFactorList() } };
      case 'compare_routes':        return this.compareRoutes(input, ctx);
      case 'generate_report':       return this.generateReport(input, ctx);
      default:                      throw new Error(`Unhandled tool: ${toolName}`);
    }
  }

  private async calculateFootprint(input: unknown, ctx: ToolCallContext): Promise<ToolCallResult> {
    const parsed: CalculateFootprintInput = CalculateFootprintInputSchema.parse(input);

    let distanceKm: number;
    let distanceEstimated: boolean;
    if (parsed.distanceKm != null) {
      distanceKm = parsed.distanceKm;
      distanceEstimated = false;
    } else if (parsed.originCountryCode && parsed.destinationCountryCode) {
      distanceKm = estimateDistanceKm(parsed.originCountryCode, parsed.destinationCountryCode);
      distanceEstimated = true;
    } else {
      distanceKm = DISTANCE_FALLBACK_KM;
      distanceEstimated = true;
    }

    const co2eKg = co2eForLeg(parsed.weightKg, distanceKm, parsed.mode);
    const cbam = checkCbam(parsed.hsCodes);
    const auditId = randomUUID();

    const result: CarbonCalculationResult = {
      co2eKg,
      co2eTonnes:     toTonnes(co2eKg),
      emissionFactor: EMISSION_FACTORS[parsed.mode],
      transportMode:  parsed.mode,
      weightTonnes:   parsed.weightKg / 1000,
      distanceKm,
      distanceEstimated,
      cbam,
      methodology:    METHODOLOGY[parsed.mode],
      auditId,
    };

    await writeAuditEvent({
      tenantId:   ctx.tenantId,
      action:     AuditAction.TOOL_CALL,
      entityType: 'carbon_footprint',
      entityId:   auditId,
      payload: {
        module:        AUDIT_MODULE,
        co2eKg,
        transportMode: parsed.mode,
        weightKg:      parsed.weightKg,
        distanceKm,
        distanceEstimated,
        cbamInScope:   cbam.inScope,
        cbamMatched:   cbam.matchedCodes,
        ...(parsed.bolNumber ? { bolNumber: parsed.bolNumber } : {}),
      },
    });

    return { success: true, data: result };
  }

  private async compareRoutes(input: unknown, ctx: ToolCallContext): Promise<ToolCallResult> {
    const parsed: CompareRoutesInput = CompareRoutesInputSchema.parse(input);

    const computed = parsed.routes.map((r) => {
      const co2eKg = co2eForLeg(parsed.weightKg, parsed.distanceKm, r.mode);
      return { label: r.label, mode: r.mode, co2eKg, emissionFactor: EMISSION_FACTORS[r.mode] };
    });

    const costs = computed.map((r) => r.co2eKg);
    const lowest = Math.min(...costs);
    const highest = Math.max(...costs);
    const lowestIdx = computed.findIndex((r) => r.co2eKg === lowest);
    const highestIdx = computed.findIndex((r) => r.co2eKg === highest);

    const routes: RouteComparisonRoute[] = computed.map((r, i) => ({
      label:          r.label,
      mode:           r.mode,
      co2eKg:         r.co2eKg,
      co2eTonnes:     toTonnes(r.co2eKg),
      emissionFactor: r.emissionFactor,
      isLowest:       i === lowestIdx,
      ...(r.co2eKg !== highest ? { reductionVsHighest: Math.round((1 - r.co2eKg / highest) * 100) } : {}),
    }));

    const cbam = checkCbam(parsed.hsCodes);
    const auditId = randomUUID();

    const result: RouteComparisonResult = {
      routes,
      lowestEmissionRoute:  computed[lowestIdx]?.label ?? '',
      highestEmissionRoute: computed[highestIdx]?.label ?? '',
      cbam: { inScope: cbam.inScope, matchedCodes: cbam.matchedCodes },
      auditId,
    };

    await writeAuditEvent({
      tenantId:   ctx.tenantId,
      action:     AuditAction.TOOL_CALL,
      entityType: 'carbon_route_comparison',
      entityId:   auditId,
      payload: {
        module:      AUDIT_MODULE,
        weightKg:    parsed.weightKg,
        distanceKm:  parsed.distanceKm,
        lowest:      result.lowestEmissionRoute,
        highest:     result.highestEmissionRoute,
        cbamInScope: cbam.inScope,
      },
    });

    return { success: true, data: result };
  }

  private async generateReport(input: unknown, ctx: ToolCallContext): Promise<ToolCallResult> {
    const parsed = GenerateReportInputSchema.parse(input);
    const from = new Date(parsed.from);
    const to = new Date(parsed.to);

    const events = await queryAuditLog(ctx.tenantId, {
      entityType: 'carbon_footprint',
      from,
      to,
      limit: 100_000,
    });

    const byMode: Record<TransportMode, { shipments: number; co2eKg: number }> = {
      TRUCK: { shipments: 0, co2eKg: 0 },
      AIR:   { shipments: 0, co2eKg: 0 },
      OCEAN: { shipments: 0, co2eKg: 0 },
      RAIL:  { shipments: 0, co2eKg: 0 },
      BARGE: { shipments: 0, co2eKg: 0 },
    };

    let totalShipments = 0;
    let totalCo2eKg = 0;
    let cbamRelevantShipments = 0;

    for (const event of events) {
      const payload = event.payload;
      const co2eKg = payload.co2eKg;
      const mode = payload.transportMode as TransportMode | undefined;
      // Skip records that don't carry a parseable footprint (do not throw).
      if (typeof co2eKg !== 'number' || !mode || !(mode in byMode)) continue;

      totalShipments += 1;
      totalCo2eKg += co2eKg;
      byMode[mode].shipments += 1;
      byMode[mode].co2eKg = round2(byMode[mode].co2eKg + co2eKg);
      if (payload.cbamInScope === true) cbamRelevantShipments += 1;
    }

    totalCo2eKg = round2(totalCo2eKg);
    const auditId = randomUUID();

    const report: CarbonReport = {
      tenantId:        ctx.tenantId,
      reportPeriod:    { from: parsed.from, to: parsed.to },
      totalShipments,
      totalCo2eKg,
      totalCo2eTonnes: toTonnes(totalCo2eKg),
      byMode,
      cbamRelevantShipments,
      methodology:     `GLEC Framework ${GLEC_VERSION}`,
      generatedAt:     new Date().toISOString(),
      auditId,
    };

    await writeAuditEvent({
      tenantId:   ctx.tenantId,
      action:     AuditAction.TOOL_CALL,
      entityType: 'carbon_report',
      entityId:   auditId,
      payload: { module: AUDIT_MODULE, from: parsed.from, to: parsed.to, totalShipments, totalCo2eKg },
    });

    return { success: true, data: report };
  }
}
