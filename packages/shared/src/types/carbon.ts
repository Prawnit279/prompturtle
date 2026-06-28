/**
 * Carbon Footprint Tracking module types (Phase 2). Deterministic CO2e
 * accounting from GLEC Framework 3.0 emission factors — no external APIs.
 * CBAM (EU Regulation 2023/956) scope detection by HS code.
 */

export type TransportMode = 'TRUCK' | 'AIR' | 'OCEAN' | 'RAIL' | 'BARGE';

export interface CarbonCalculationInput {
  mode: TransportMode;
  weightKg: number;
  distanceKm?: number;                // if not provided, estimated from origin/destination
  originCity?: string;
  originCountryCode?: string;
  destinationCity?: string;
  destinationCountryCode?: string;
  hsCodes?: string[];                 // for CBAM check
  bolNumber?: string;                 // for reference logging
}

export interface CarbonCbamResult {
  inScope: boolean;
  matchedCodes: string[];             // which HS codes triggered CBAM scope
  reportingNote?: string;
}

export interface CarbonCalculationResult {
  co2eKg: number;                     // kg CO2e for this shipment
  co2eTonnes: number;                 // same, in tonnes (co2eKg / 1000)
  emissionFactor: number;            // kg CO2e per tonne-km used
  transportMode: TransportMode;
  weightTonnes: number;              // weightKg / 1000
  distanceKm: number;                // actual or estimated
  distanceEstimated: boolean;        // true if distance was calculated, not provided
  cbam: CarbonCbamResult;
  methodology: string;               // e.g. "GLEC Framework 3.0 — ICAO"
  auditId: string;
}

export interface RouteComparisonInput {
  weightKg: number;
  distanceKm: number;
  routes: Array<{
    label: string;                   // e.g. "Current route", "Alternative 1"
    mode: TransportMode;
  }>;
  hsCodes?: string[];
}

export interface RouteComparisonRoute {
  label: string;
  mode: TransportMode;
  co2eKg: number;
  co2eTonnes: number;
  emissionFactor: number;
  isLowest: boolean;                 // true for the lowest-emission option
  reductionVsHighest?: number;       // % reduction vs the highest-emission option
}

export interface RouteComparisonResult {
  routes: RouteComparisonRoute[];
  lowestEmissionRoute: string;       // label of the lowest
  highestEmissionRoute: string;      // label of the highest
  cbam: { inScope: boolean; matchedCodes: string[] };
  auditId: string;
}

export interface CarbonReport {
  tenantId: string;
  reportPeriod: { from: string; to: string };  // ISO 8601 dates
  totalShipments: number;
  totalCo2eKg: number;
  totalCo2eTonnes: number;
  byMode: Record<TransportMode, { shipments: number; co2eKg: number }>;
  cbamRelevantShipments: number;
  methodology: string;
  generatedAt: string;               // ISO 8601
  auditId: string;
}

export interface EmissionFactorEntry {
  mode: TransportMode;
  factor: number;                    // kg CO2e per tonne-km
  source: string;
  glecVersion: string;
}
