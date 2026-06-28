import { z } from 'zod';

import { registerToolSchema } from '../../../guardrails/rules/InputSchemaRule.js';

export const TransportModeSchema = z.enum(['TRUCK', 'AIR', 'OCEAN', 'RAIL', 'BARGE']);

// ---- calculate_footprint ----

export const CalculateFootprintInput = z.object({
  mode:                   TransportModeSchema,
  weightKg:               z.number().positive(),
  distanceKm:             z.number().positive().optional(),
  originCity:             z.string().optional(),
  originCountryCode:      z.string().optional(),
  destinationCity:        z.string().optional(),
  destinationCountryCode: z.string().optional(),
  hsCodes:                z.array(z.string()).optional(),
  bolNumber:              z.string().optional(),
});

export type CalculateFootprintInput = z.infer<typeof CalculateFootprintInput>;

// ---- compare_routes ----

export const CompareRoutesInput = z.object({
  weightKg:   z.number().positive(),
  distanceKm: z.number().positive(),
  routes:     z.array(z.object({ label: z.string().min(1), mode: TransportModeSchema })).min(1),
  hsCodes:    z.array(z.string()).optional(),
});

export type CompareRoutesInput = z.infer<typeof CompareRoutesInput>;

// ---- generate_report ----

export const GenerateReportInput = z.object({
  from: z.string().min(1),
  to:   z.string().min(1),
});

export type GenerateReportInput = z.infer<typeof GenerateReportInput>;

// ---- get_emission_factors (no input) ----

export const GetEmissionFactorsInput = z.object({}).passthrough();

export function registerCarbonSchemas(): void {
  registerToolSchema('carbon-tracking', 'calculate_footprint', CalculateFootprintInput);
  registerToolSchema('carbon-tracking', 'compare_routes', CompareRoutesInput);
  registerToolSchema('carbon-tracking', 'generate_report', GenerateReportInput);
  registerToolSchema('carbon-tracking', 'get_emission_factors', GetEmissionFactorsInput);
}
