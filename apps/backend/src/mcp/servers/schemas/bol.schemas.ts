import { z } from 'zod';

import { registerToolSchema } from '../../../guardrails/rules/InputSchemaRule.js';

// ---- Shared ----

export const BolTypeSchema = z.enum(['TRUCK_BOL', 'AIR_WAYBILL', 'OCEAN_BOL']);
export type BolTypeSchema = z.infer<typeof BolTypeSchema>;

// ---- extract_bol_fields ----

export const ExtractBolFieldsInput = z.object({
  /** Raw BOL text content — OCR output, PDF text, or manual entry */
  rawText: z.string().min(10).max(50_000),
  /** Optional hint about the carrier format to improve extraction accuracy */
  carrierHint: z.string().max(100).optional(),
  /** Document type — determines which fields are extracted. Defaults to TRUCK_BOL. */
  bolType: BolTypeSchema.default('TRUCK_BOL'),
});

export type ExtractBolFieldsInput = z.infer<typeof ExtractBolFieldsInput>;

/** Truck BOL extracted output (backward-compatible) */
export const ExtractBolFieldsOutput = z.object({
  bolNumber:            z.string().optional(),
  shipperName:          z.string().optional(),
  consigneeName:        z.string().optional(),
  originPort:           z.string().optional(),
  destinationPort:      z.string().optional(),
  carrierName:          z.string().optional(),
  vesselName:           z.string().optional(),
  departureDate:        z.string().optional(),
  arrivalDate:          z.string().optional(),
  commodityCode:        z.string().optional(),
  grossWeightKg:        z.number().optional(),
  packageCount:         z.number().int().optional(),
  containerNumbers:     z.array(z.string()).optional(),
  freightTerms:         z.enum(['PREPAID', 'COLLECT', 'THIRD_PARTY']).optional(),
  extractionConfidence: z.number().min(0).max(1),
});

export type ExtractBolFieldsOutput = z.infer<typeof ExtractBolFieldsOutput>;

/** Air Waybill extracted output */
export const AirWaybillExtractedOutput = z.object({
  awbNumber:            z.string(),
  mawbNumber:           z.string().optional(),
  hawbNumber:           z.string().optional(),
  airlineCode:          z.string(),
  flightNumber:         z.string().optional(),
  originAirport:        z.string(),
  destinationAirport:   z.string(),
  shipperName:          z.string().optional(),
  shipperAddress:       z.string().optional(),
  consigneeName:        z.string().optional(),
  consigneeAddress:     z.string().optional(),
  notifyPartyName:      z.string().optional(),
  pieces:               z.number().int(),
  grossWeightKg:        z.number(),
  chargeableWeightKg:   z.number(),
  commodity:            z.string(),
  declaredValue:        z.number().optional(),
  currency:             z.string().optional(),
  freightCharges:       z.enum(['prepaid', 'collect']),
  incoterms:            z.string().optional(),
  specialHandling:      z.array(z.string()).optional(),
  extractionConfidence: z.number().min(0).max(1),
});

export type AirWaybillExtractedOutput = z.infer<typeof AirWaybillExtractedOutput>;

/** Ocean BOL extracted output */
export const OceanBolExtractedOutput = z.object({
  bolNumber:            z.string(),
  mblNumber:            z.string().optional(),
  hblNumber:            z.string().optional(),
  vesselName:           z.string(),
  voyageNumber:         z.string(),
  portOfLoading:        z.string(),
  portOfDischarge:      z.string(),
  placeOfReceipt:       z.string().optional(),
  placeOfDelivery:      z.string().optional(),
  shipperName:          z.string().optional(),
  shipperAddress:       z.string().optional(),
  consigneeName:        z.string().optional(),
  consigneeAddress:     z.string().optional(),
  notifyPartyName:      z.string().optional(),
  containers: z.array(
    z.object({
      containerNumber: z.string(),
      sealNumber:      z.string().optional(),
      type:            z.string(),
      weightKg:        z.number(),
      cbm:             z.number().optional(),
    }),
  ).default([]),
  commodity:            z.string(),
  grossWeightKg:        z.number(),
  cbm:                  z.number().optional(),
  freightTerms:         z.enum(['prepaid', 'collect']),
  incoterms:            z.string().optional(),
  hsCode:               z.string().optional(),
  customsBroker: z.object({
    name:          z.string(),
    licenseNumber: z.string().optional(),
    verified:      z.boolean(),
  }).optional(),
  extractionConfidence: z.number().min(0).max(1),
});

export type OceanBolExtractedOutput = z.infer<typeof OceanBolExtractedOutput>;

// ---- validate_bol_data ----

/**
 * Mirrors ComplianceFlagCode in @prompturtle/shared (packages/shared/src/types/bol.ts).
 * Kept as an explicit enum (rather than z.string()) so the wire contract stays in
 * lockstep with the shared type — a typo'd or new code fails validation loudly
 * instead of silently passing through as an arbitrary string.
 */
export const ComplianceFlagCodeSchema = z.enum([
  // Truck BOL flags
  'MISSING_SCAC',
  'INVALID_PRO_NUMBER',
  'MISSING_DELIVERY_ADDRESS',
  // Air Waybill flags
  'INVALID_AWB_NUMBER',
  'MISSING_HAWB',
  'INVALID_AIRPORT_CODE',
  'DANGEROUS_GOODS_UNDECLARED',
  'WEIGHT_DISCREPANCY',
  // Ocean BOL flags
  'MISSING_CONTAINER_NUMBERS',
  'CONTAINER_FORMAT_INVALID',
  'MISSING_PORT_CODES',
  'HBL_WITHOUT_MBL',
  'CUSTOMS_BROKER_UNVERIFIED',
]);

export const ComplianceFlagSchema = z.object({
  code:     ComplianceFlagCodeSchema,
  severity: z.enum(['info', 'warning', 'critical']),
  message:  z.string(),
  field:    z.string().optional(),
});

export type ComplianceFlagSchema = z.infer<typeof ComplianceFlagSchema>;

export const ValidateBolDataInput = z.object({
  /** Extracted BOL fields — shape varies by bolType */
  bolFields:  z.record(z.unknown()),
  strictness: z.enum(['lenient', 'standard', 'strict']).default('standard'),
  bolType:    BolTypeSchema.default('TRUCK_BOL'),
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
  /** Type-specific compliance flags computed by pure logic (not LLM) */
  complianceFlags: z.array(ComplianceFlagSchema).default([]),
});

export type ValidateBolDataOutput = z.infer<typeof ValidateBolDataOutput>;

// ---- flag_bol_discrepancies ----

export const FlagBolDiscrepanciesInput = z.object({
  bolFields:    z.record(z.unknown()),
  referenceDoc: z.record(z.unknown()).describe('PO or shipment record as key-value pairs'),
  referenceType: z.enum(['PURCHASE_ORDER', 'SHIPMENT_RECORD', 'INVOICE']),
  /** Optional: inferred from bolFields.bolType if present */
  bolType: BolTypeSchema.default('TRUCK_BOL'),
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

// ---- Minimal shapes for compliance checkers ----

/** Minimal Truck BOL shape needed to run compliance checks */
export const TruckBolComplianceInput = z.object({
  scacCode:  z.string().optional(),
  proNumber: z.string().optional(),
  consignee: z.object({
    name:    z.string(),
    address: z.string(),
  }).optional(),
});

export const AwbComplianceInput = z.object({
  awbNumber:          z.string(),
  originAirport:      z.string(),
  destinationAirport: z.string(),
  pieces:             z.number().int(),
  grossWeightKg:      z.number(),
  chargeableWeightKg: z.number(),
  commodity:          z.string(),
  hawbNumber:         z.string().optional(),
  specialHandling:    z.array(z.string()).optional(),
});

export const OceanBolComplianceInput = z.object({
  portOfLoading:   z.string(),
  portOfDischarge: z.string(),
  containers: z.array(
    z.object({ containerNumber: z.string() }),
  ).default([]),
  hblNumber:     z.string().optional(),
  mblNumber:     z.string().optional(),
  customsBroker: z.object({ verified: z.boolean() }).optional(),
});

// ---- Register schemas with guardrail engine ----

export function registerBolSchemas(): void {
  registerToolSchema('bol-processor', 'extract_bol_fields',     ExtractBolFieldsInput);
  registerToolSchema('bol-processor', 'validate_bol_data',      ValidateBolDataInput);
  registerToolSchema('bol-processor', 'flag_bol_discrepancies', FlagBolDiscrepanciesInput);
}
