import { z } from 'zod';

import { registerToolSchema } from '../../../guardrails/rules/InputSchemaRule.js';

// ---- extract_bol_fields ----

export const ExtractBolFieldsInput = z.object({
  /** Raw BOL text content — OCR output, PDF text, or manual entry */
  rawText: z.string().min(10).max(50_000),
  /** Optional hint about the carrier format to improve extraction accuracy */
  carrierHint: z.string().max(100).optional(),
});

export type ExtractBolFieldsInput = z.infer<typeof ExtractBolFieldsInput>;

export const ExtractBolFieldsOutput = z.object({
  bolNumber:            z.string().optional(),
  shipperName:          z.string().optional(),
  consigneeName:        z.string().optional(),
  originPort:           z.string().optional(),
  destinationPort:      z.string().optional(),
  carrierName:          z.string().optional(),
  vesselName:           z.string().optional(),
  departureDate:        z.string().optional(),   // ISO 8601
  arrivalDate:          z.string().optional(),   // ISO 8601
  commodityCode:        z.string().optional(),   // HTS code if present
  grossWeightKg:        z.number().optional(),
  packageCount:         z.number().int().optional(),
  containerNumbers:     z.array(z.string()).optional(),
  freightTerms:         z.enum(['PREPAID', 'COLLECT', 'THIRD_PARTY']).optional(),
  extractionConfidence: z.number().min(0).max(1), // 0–1
});

export type ExtractBolFieldsOutput = z.infer<typeof ExtractBolFieldsOutput>;

// ---- validate_bol_data ----

export const ValidateBolDataInput = z.object({
  bolFields: ExtractBolFieldsOutput,
  /** Optional validation strictness — defaults to 'standard' */
  strictness: z.enum(['lenient', 'standard', 'strict']).default('standard'),
});

export type ValidateBolDataInput = z.infer<typeof ValidateBolDataInput>;

export const ValidateBolDataOutput = z.object({
  isValid: z.boolean(),
  errors: z.array(
    z.object({
      field:    z.string(),
      message:  z.string(),
      severity: z.enum(['error', 'warning']),
    }),
  ),
  missingRequiredFields: z.array(z.string()),
});

export type ValidateBolDataOutput = z.infer<typeof ValidateBolDataOutput>;

// ---- flag_bol_discrepancies ----

export const FlagBolDiscrepanciesInput = z.object({
  bolFields: ExtractBolFieldsOutput,
  /** Purchase order or shipment record to compare against */
  referenceDoc: z.record(z.unknown()).describe('PO or shipment record as key-value pairs'),
  /** What type of reference document this is */
  referenceType: z.enum(['PURCHASE_ORDER', 'SHIPMENT_RECORD', 'INVOICE']),
});

export type FlagBolDiscrepanciesInput = z.infer<typeof FlagBolDiscrepanciesInput>;

export const FlagBolDiscrepanciesOutput = z.object({
  hasDiscrepancies: z.boolean(),
  discrepancies: z.array(
    z.object({
      field:          z.string(),
      bolValue:       z.unknown(),
      referenceValue: z.unknown(),
      severity:       z.enum(['critical', 'major', 'minor']),
      explanation:    z.string(),
    }),
  ),
  recommendedAction: z.enum([
    'APPROVE',
    'FLAG_FOR_REVIEW',
    'REJECT',
    'REQUEST_AMENDMENT',
  ]),
  summary: z.string(),
});

export type FlagBolDiscrepanciesOutput = z.infer<typeof FlagBolDiscrepanciesOutput>;

// ---- Register schemas with guardrail engine ----

export function registerBolSchemas(): void {
  registerToolSchema('bol-processor', 'extract_bol_fields',     ExtractBolFieldsInput);
  registerToolSchema('bol-processor', 'validate_bol_data',      ValidateBolDataInput);
  registerToolSchema('bol-processor', 'flag_bol_discrepancies', FlagBolDiscrepanciesInput);
}
