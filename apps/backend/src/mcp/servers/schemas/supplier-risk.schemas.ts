import { z } from 'zod';

import { registerToolSchema } from '../../../guardrails/rules/InputSchemaRule.js';

// ---- score_supplier / get_supplier_profile (shared input) ----

export const SupplierTransactionInput = z.object({
  date:             z.string(),
  orderValue:       z.number().nonnegative(),
  currency:         z.string(),
  deliveredOnTime:  z.boolean(),
  qualityDefects:   z.number().int().min(0),
  complianceFlags:  z.array(z.string()).optional(),
  documentAccuracy: z.boolean(),
});

export const ScoreSupplierInput = z.object({
  supplierId:      z.string().min(1),
  supplierName:    z.string().min(1),
  countryCode:     z.string().length(2),
  transactions:    z.array(SupplierTransactionInput).min(1),
  certifications:  z.array(z.string()).optional(),
  yearsInBusiness: z.number().nonnegative().optional(),
  hsCodesTraded:   z.array(z.string()).optional(),
});

export type ScoreSupplierInput = z.infer<typeof ScoreSupplierInput>;

// ---- list_certifications (no input) ----

export const ListCertificationsInput = z.object({}).passthrough();

export function registerSupplierRiskSchemas(): void {
  registerToolSchema('supplier-risk', 'score_supplier', ScoreSupplierInput);
  registerToolSchema('supplier-risk', 'get_supplier_profile', ScoreSupplierInput);
  registerToolSchema('supplier-risk', 'list_certifications', ListCertificationsInput);
}
