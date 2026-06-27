/**
 * Supplier Risk module types (Phase 2). Mirrors the Shipment Risk Scorer:
 * deterministic 0–100 score with a per-factor breakdown. Reuses RiskLevel /
 * RiskFactor from ./risk.
 */
import type { RiskFactor, RiskLevel } from './risk';

export interface SupplierTransaction {
  date: string;                   // ISO 8601
  orderValue: number;
  currency: string;
  deliveredOnTime: boolean;
  qualityDefects: number;         // 0 = none, 1–2 = minor, 3+ = significant
  complianceFlags?: string[];     // any compliance issues on this transaction
  documentAccuracy: boolean;      // was documentation complete and correct?
}

export interface ScoreSupplierInput {
  supplierId: string;             // vendor-defined identifier
  supplierName: string;
  countryCode: string;            // ISO 3166-1 alpha-2 (e.g. 'CN', 'DE', 'US')
  transactions: SupplierTransaction[]; // minimum 1, ideally 10+ for accuracy
  certifications?: string[];      // e.g. ['ISO_9001', 'ISO_14001', 'C_TPAT']
  yearsInBusiness?: number;
  hsCodesTraded?: string[];       // for CBAM check
}

export type SupplierRecommendation = 'approve' | 'review' | 'probation' | 'reject';

export interface SupplierRiskBreakdown {
  onTimeDelivery:     RiskFactor; // weight 0.30
  qualityConsistency: RiskFactor; // weight 0.25
  complianceHistory:  RiskFactor; // weight 0.25
  documentAccuracy:   RiskFactor; // weight 0.15
  countryRisk:        RiskFactor; // weight 0.05
}

export interface SupplierSanctionsCheck {
  checked: boolean;
  flagged: boolean;
  matchedList?: string;
}

export interface SupplierRiskResult {
  riskScore: number;              // 0–100 weighted composite
  riskLevel: RiskLevel;
  recommendation: SupplierRecommendation;
  breakdown: SupplierRiskBreakdown;
  sanctions: SupplierSanctionsCheck;
  cbamRelevant: boolean;          // true if hsCodesTraded includes CBAM-scope codes
  auditId: string;
  transactionCount: number;
  lookbackDays: number;
  /** Optional model-generated contextual summary (only for ≥10 txns and score ≥40). */
  summary?: string;
}

/** Lightweight gate-check shape returned by get_supplier_profile. */
export interface SupplierProfileResult {
  riskLevel: RiskLevel;
  recommendation: SupplierRecommendation;
  sanctions: SupplierSanctionsCheck;
  cbamRelevant: boolean;
}
