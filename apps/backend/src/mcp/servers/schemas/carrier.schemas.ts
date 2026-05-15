import { z } from 'zod';

import { registerToolSchema } from '../../../guardrails/rules/InputSchemaRule.js';

// ---- Shared sub-schemas ----

export const ShipmentDimensions = z.object({
  lengthCm: z.number().positive(),
  widthCm:  z.number().positive(),
  heightCm: z.number().positive(),
});

export type ShipmentDimensions = z.infer<typeof ShipmentDimensions>;

export const CarrierQuote = z.object({
  carrierId:      z.string(),
  carrierName:    z.string(),
  serviceLevel:   z.enum(['EXPRESS', 'STANDARD', 'ECONOMY', 'FREIGHT']),
  totalCostUsd:   z.number().nonnegative(),
  transitDays:    z.number().int().positive(),
  transitDaysMin: z.number().int().positive().optional(),
  transitDaysMax: z.number().int().positive().optional(),
  currency:       z.string().default('USD'),
  validUntil:     z.string().optional(), // ISO 8601
  notes:          z.string().optional(),
});

export type CarrierQuote = z.infer<typeof CarrierQuote>;

// ---- get_carrier_rates ----

export const GetCarrierRatesInput = z.object({
  originCountry:        z.string().length(2).describe('ISO 3166-1 alpha-2 country code'),
  destinationCountry:   z.string().length(2).describe('ISO 3166-1 alpha-2 country code'),
  originCity:           z.string().optional(),
  destinationCity:      z.string().optional(),
  weightKg:             z.number().positive().max(50_000),
  dimensions:           ShipmentDimensions.optional(),
  commodityDescription: z.string().max(500).optional(),
  incoterms:            z.enum(['EXW', 'FOB', 'CIF', 'DAP', 'DDP', 'FCA']).optional(),
  requiredServiceLevel: z.enum(['EXPRESS', 'STANDARD', 'ECONOMY', 'FREIGHT', 'ANY']).default('ANY'),
  carriers:             z
    .array(z.string())
    .max(10)
    .optional()
    .describe(
      'Optional list of specific carrier IDs to quote. If omitted, quotes all available carriers.',
    ),
});

export type GetCarrierRatesInput = z.infer<typeof GetCarrierRatesInput>;

export const GetCarrierRatesOutput = z.object({
  quotes:            z.array(CarrierQuote),
  currency:          z.string().default('USD'),
  quotedAt:          z.string(), // ISO 8601 timestamp
  cheapestCarrierId: z.string().optional(),
  fastestCarrierId:  z.string().optional(),
});

export type GetCarrierRatesOutput = z.infer<typeof GetCarrierRatesOutput>;

// ---- compare_carrier_options ----

export const CompareCarrierOptionsInput = z.object({
  quotes:          z.array(CarrierQuote).min(2).max(10),
  shipmentContext: z.object({
    weightKg:             z.number().positive(),
    destinationCountry:   z.string().length(2),
    commodityDescription: z.string().optional(),
    incoterms:            z.string().optional(),
  }),
});

export type CompareCarrierOptionsInput = z.infer<typeof CompareCarrierOptionsInput>;

export const CompareCarrierOptionsOutput = z.object({
  comparison: z.array(
    z.object({
      carrierId:    z.string(),
      carrierName:  z.string(),
      costScore:    z.number().min(0).max(10).describe('10 = cheapest'),
      speedScore:   z.number().min(0).max(10).describe('10 = fastest'),
      overallScore: z.number().min(0).max(10),
      pros:         z.array(z.string()),
      cons:         z.array(z.string()),
    }),
  ),
  summary: z.string(),
});

export type CompareCarrierOptionsOutput = z.infer<typeof CompareCarrierOptionsOutput>;

// ---- recommend_carrier ----

export const RecommendCarrierInput = z.object({
  quotes: z.array(CarrierQuote).min(1).max(10),
  priorities: z
    .object({
      costWeight:        z.number().min(0).max(1).describe('0 = ignore cost, 1 = cost is everything'),
      speedWeight:       z.number().min(0).max(1).describe('0 = ignore speed, 1 = speed is everything'),
      reliabilityWeight: z.number().min(0).max(1).optional(),
    })
    .refine(
      (p) => p.costWeight + p.speedWeight + (p.reliabilityWeight ?? 0) <= 1.01,
      { message: 'Weights must sum to ≤ 1.0' },
    ),
  constraints: z
    .object({
      maxBudgetUsd:     z.number().positive().optional(),
      mustArriveBy:     z.string().optional(), // ISO 8601 date
      requiredCarriers: z.array(z.string()).optional(),
      excludedCarriers: z.array(z.string()).optional(),
    })
    .optional(),
  businessContext: z
    .string()
    .max(500)
    .optional()
    .describe(
      'Free-text context: customer SLA, seasonal urgency, relationship constraints, etc.',
    ),
});

export type RecommendCarrierInput = z.infer<typeof RecommendCarrierInput>;

export const RecommendCarrierOutput = z.object({
  recommendedCarrierId:   z.string(),
  recommendedCarrierName: z.string(),
  confidence:             z.number().min(0).max(1),
  rationale:              z.string(),
  alternatives: z
    .array(
      z.object({
        carrierId:   z.string(),
        carrierName: z.string(),
        reason:      z.string().describe('Why this is the runner-up'),
      }),
    )
    .max(2),
  warnings: z
    .array(z.string())
    .optional()
    .describe('Budget exceeded, tight transit window, etc.'),
});

export type RecommendCarrierOutput = z.infer<typeof RecommendCarrierOutput>;

// ---- Register with guardrail engine ----

export function registerCarrierSchemas(): void {
  registerToolSchema('carrier-rates', 'get_carrier_rates',       GetCarrierRatesInput);
  registerToolSchema('carrier-rates', 'compare_carrier_options', CompareCarrierOptionsInput);
  registerToolSchema('carrier-rates', 'recommend_carrier',       RecommendCarrierInput);
}
