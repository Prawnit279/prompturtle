import { z } from 'zod';

import { registerToolSchema } from '../../../guardrails/rules/InputSchemaRule.js';

// ---- score_shipment ----

export const ComplianceFlagInput = z.object({
  code: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string(),
  field: z.string().optional(),
});

export type ComplianceFlagInput = z.infer<typeof ComplianceFlagInput>;

export const ScoreShipmentInput = z.object({
  bolType: z.enum(['TRUCK_BOL', 'AIR_WAYBILL', 'OCEAN_BOL']).optional(),
  /** Full parsed BOL — accepted loosely; the risk scorer reads only top-level signal fields */
  bol: z.record(z.string(), z.unknown()).optional(),
  htsResult: z
    .object({
      hsCode: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
      dutyRate: z.string().optional(),
    })
    .optional(),
  carrierResult: z
    .object({
      carrier: z.string().optional(),
      isApprovedCarrier: z.boolean().optional(),
      score: z.number().optional(),
    })
    .optional(),
  shipmentCost: z
    .object({
      total: z.number().nonnegative(),
      currency: z.string(),
    })
    .optional(),
  customsBroker: z
    .object({
      name: z.string().optional(),
      verified: z.boolean(),
    })
    .optional(),
  customsRequired: z.boolean().optional(),
  complianceFlags: z.array(ComplianceFlagInput).optional(),
});

export type ScoreShipmentInput = z.infer<typeof ScoreShipmentInput>;

// ---- Register with guardrail engine ----

export function registerRiskScorerSchemas(): void {
  registerToolSchema('risk-scorer', 'score_shipment', ScoreShipmentInput);
}
