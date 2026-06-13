import type { BolType, ComplianceFlag, ParsedBol } from './bol';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RiskRecommendation = 'proceed' | 'review' | 'halt';

export interface RiskFactor {
  score: number;
  weight: number;
  level: RiskLevel;
  detail: string;
  signals: string[];
}

export interface RiskFactorBreakdown {
  htsConfidence: RiskFactor;
  complianceFlags: RiskFactor;
  carrierApproval: RiskFactor;
  costThreshold: RiskFactor;
  customsReadiness: RiskFactor;
}

export interface ShipmentRiskResult {
  riskScore: number;
  riskLevel: RiskLevel;
  recommendation: RiskRecommendation;
  breakdown: RiskFactorBreakdown;
  guardrailsFired: string[];
  auditId: string;
  decision: 'accepted' | 'halted' | 'escalated';
}

export interface ScoreShipmentInput {
  bolType?: BolType;
  bol?: ParsedBol;
  htsResult?: {
    hsCode?: string;
    confidence?: number;
    dutyRate?: string;
  };
  carrierResult?: {
    carrier?: string;
    isApprovedCarrier?: boolean;
    score?: number;
  };
  shipmentCost?: {
    total: number;
    currency: string;
  };
  customsBroker?: {
    name?: string;
    verified: boolean;
  };
  customsRequired?: boolean;
  complianceFlags?: ComplianceFlag[];
}
