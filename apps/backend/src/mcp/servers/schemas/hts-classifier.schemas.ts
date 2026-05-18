import { z } from 'zod';

import { registerToolSchema } from '../../../guardrails/rules/InputSchemaRule.js';

// ---- classify_product ----

export const ClassifyProductInput = z.object({
  /** Free-text description of the product to classify */
  productDescription: z.string().min(5).max(2000),
  /** Optional additional context: material, use case, origin country */
  context: z.string().max(500).optional(),
  /** Number of candidate HTS codes to retrieve from pgvector before Opus re-ranks */
  candidateCount: z.number().int().min(1).max(10).default(5),
});

export type ClassifyProductInput = z.infer<typeof ClassifyProductInput>;

export const ClassifyProductOutput = z.object({
  htsCode:     z.string(),
  description: z.string(),
  chapter:     z.string(),
  dutyRate:    z.string(),
  confidence:  z.number().min(0).max(1),
  reasoning:   z.string(),
  alternativeCodes: z.array(z.object({
    htsCode:     z.string(),
    description: z.string(),
    confidence:  z.number().min(0).max(1),
    reason:      z.string(),
  })).max(3),
  warnings: z.array(z.string()).optional(),
});

export type ClassifyProductOutput = z.infer<typeof ClassifyProductOutput>;

// ---- validate_classification ----

export const ValidateClassificationInput = z.object({
  htsCode:            z.string().min(4).max(20),
  productDescription: z.string().min(5).max(2000),
  /** Optional declared duty rate to cross-check */
  declaredDutyRate:   z.string().optional(),
});

export type ValidateClassificationInput = z.infer<typeof ValidateClassificationInput>;

export const ValidateClassificationOutput = z.object({
  isValid:    z.boolean(),
  confidence: z.number().min(0).max(1),
  issues: z.array(z.object({
    severity: z.enum(['critical', 'major', 'minor']),
    message:  z.string(),
  })),
  suggestedCode: z.string().optional(),
  explanation:   z.string(),
});

export type ValidateClassificationOutput = z.infer<typeof ValidateClassificationOutput>;

// ---- get_duty_rates ----

export const GetDutyRatesInput = z.object({
  htsCode: z.string().min(4).max(20),
});

export type GetDutyRatesInput = z.infer<typeof GetDutyRatesInput>;

export const GetDutyRatesOutput = z.object({
  htsCode:     z.string(),
  description: z.string(),
  dutyRate:    z.string(),
  unit:        z.string().optional(),
  chapter:     z.string(),
  found:       z.boolean(),
});

export type GetDutyRatesOutput = z.infer<typeof GetDutyRatesOutput>;

// ---- Register with guardrail engine ----

export function registerHtsClassifierSchemas(): void {
  registerToolSchema('hts-classifier', 'classify_product',        ClassifyProductInput);
  registerToolSchema('hts-classifier', 'validate_classification',  ValidateClassificationInput);
  registerToolSchema('hts-classifier', 'get_duty_rates',           GetDutyRatesInput);
}
