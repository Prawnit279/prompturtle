import { randomUUID } from 'crypto';

import Anthropic from '@anthropic-ai/sdk';

import { AuditAction } from '@prompturtle/shared';
import type {
  RiskFactor,
  RiskLevel,
  SupplierProfileResult,
  SupplierRecommendation,
  SupplierRiskResult,
  SupplierSanctionsCheck,
} from '@prompturtle/shared';

import { writeAuditEvent } from '../../lib/audit.js';
import { trackedCall, type ModelName } from '../../lib/cost-tracker.js';
import logger from '../../lib/logger.js';
import { BaseMCPServer } from '../BaseMCPServer.js';
import type { ToolCallContext, ToolCallResult, ToolDefinition } from '../types.js';
import {
  ScoreSupplierInput as ScoreSupplierInputSchema,
  registerSupplierRiskSchemas,
  type ScoreSupplierInput,
} from './schemas/supplier-risk.schemas.js';

// ---- Factor weights (sum to 1.0) ----
const WEIGHTS = {
  onTimeDelivery:     0.30,
  qualityConsistency: 0.25,
  complianceHistory:  0.25,
  documentAccuracy:   0.15,
  countryRisk:        0.05,
} as const;

// Hardcoded country-risk tiers (no external API). Default for unlisted: 45.
const COUNTRY_RISK_SCORE: Record<string, number> = {
  US: 0, GB: 0, DE: 0, FR: 0, NL: 0, BE: 0, SE: 0, DK: 0, NO: 0, FI: 0,
  AU: 0, NZ: 0, JP: 0, KR: 0, SG: 0, CA: 0, CH: 0, AT: 0, IE: 0, IT: 0,
  ES: 0, PT: 0, LU: 0, IL: 0, AE: 5,
  MX: 35, BR: 35, IN: 35, VN: 35, TH: 35, MY: 35, PH: 35, TR: 35,
  ID: 35, ZA: 35, CL: 35, CO: 35, PE: 35, EG: 35, MA: 35, NG: 35,
  CN: 65, PK: 65, BD: 65, ET: 65, KE: 65, GH: 65, UZ: 65, KZ: 65,
  RU: 95, BY: 95, IR: 95, KP: 95, SY: 95, CU: 95, VE: 95,
};
const DEFAULT_COUNTRY_RISK = 45;

// CBAM-scope HS codes (EU Carbon Border Adjustment Mechanism).
const CBAM_HS_PREFIXES = ['2523', '2716', '2804', '3102', '3103', '3104', '3105'];
const CBAM_HS_CHAPTERS = ['72', '73', '76']; // iron/steel, aluminum

// Recognized certifications (reference only — no scoring impact in v1).
const CERTIFICATIONS = [
  { code: 'ISO_9001',  description: 'Quality management systems — consistent process control.' },
  { code: 'ISO_14001', description: 'Environmental management systems.' },
  { code: 'C_TPAT',    description: 'Customs-Trade Partnership Against Terrorism (US supply-chain security).' },
  { code: 'AEO',       description: 'Authorized Economic Operator (EU customs trust status).' },
  { code: 'SMETA',     description: 'Sedex Members Ethical Trade Audit (labor & ethics).' },
  { code: 'SA8000',    description: 'Social accountability / workplace conditions.' },
] as const;

const SUMMARY_MODEL: ModelName = 'claude-haiku-4-5-20251001';
const SUMMARY_MIN_TRANSACTIONS = 10;
const SUMMARY_MIN_SCORE = 40;

const anthropic = new Anthropic();

function makeFactor(score: number, weight: number, level: RiskLevel, detail: string, signals: string[]): RiskFactor {
  return { score, weight, level, detail, signals };
}

// ---- Per-factor scorers (explicit levels per the spec bands) ----

function scoreOnTimeDelivery(txns: ScoreSupplierInput['transactions']): RiskFactor {
  const w = WEIGHTS.onTimeDelivery;
  if (txns.length < 3) {
    return makeFactor(40, w, 'medium', 'Insufficient history (fewer than 3 transactions)', ['insufficient_history']);
  }
  const pct = (txns.filter((t) => t.deliveredOnTime).length / txns.length) * 100;
  if (pct >= 95) return makeFactor(0,  w, 'low',      `${pct.toFixed(0)}% on-time delivery`, ['on_time_excellent']);
  if (pct >= 85) return makeFactor(25, w, 'low',      `${pct.toFixed(0)}% on-time delivery`, ['on_time_good']);
  if (pct >= 70) return makeFactor(50, w, 'medium',   `${pct.toFixed(0)}% on-time delivery`, ['on_time_fair']);
  if (pct >= 50) return makeFactor(75, w, 'high',     `${pct.toFixed(0)}% on-time delivery`, ['on_time_poor']);
  return makeFactor(95, w, 'critical', `${pct.toFixed(0)}% on-time delivery`, ['on_time_critical']);
}

function scoreQualityConsistency(txns: ScoreSupplierInput['transactions']): RiskFactor {
  const w = WEIGHTS.qualityConsistency;
  const avg = txns.reduce((s, t) => s + t.qualityDefects, 0) / txns.length;
  const d = `${avg.toFixed(2)} avg defects/shipment`;
  if (avg === 0)   return makeFactor(0,  w, 'low',      d, ['quality_perfect']);
  if (avg <= 0.5)  return makeFactor(20, w, 'low',      d, ['quality_good']);
  if (avg <= 1.5)  return makeFactor(50, w, 'medium',   d, ['quality_fair']);
  if (avg <= 3)    return makeFactor(75, w, 'high',     d, ['quality_poor']);
  return makeFactor(95, w, 'critical', d, ['quality_critical']);
}

function scoreComplianceHistory(txns: ScoreSupplierInput['transactions']): RiskFactor {
  const w = WEIGHTS.complianceHistory;
  const flagged = txns.filter((t) => (t.complianceFlags?.length ?? 0) > 0).length;
  const pct = (flagged / txns.length) * 100;
  const d = `${flagged}/${txns.length} transactions with compliance flags`;
  if (flagged === 0) return makeFactor(0,  w, 'low',      'No compliance flags on record', ['compliance_clean']);
  if (pct < 5)       return makeFactor(20, w, 'low',      d, ['compliance_minor']);
  if (pct < 15)      return makeFactor(55, w, 'medium',   d, ['compliance_moderate']);
  if (pct <= 30)     return makeFactor(75, w, 'high',     d, ['compliance_elevated']);
  return makeFactor(95, w, 'critical', d, ['compliance_severe']);
}

function scoreDocumentAccuracy(txns: ScoreSupplierInput['transactions']): RiskFactor {
  const w = WEIGHTS.documentAccuracy;
  const pct = (txns.filter((t) => t.documentAccuracy).length / txns.length) * 100;
  const d = `${pct.toFixed(0)}% documentation accuracy`;
  if (pct >= 95) return makeFactor(0,  w, 'low',    d, ['docs_excellent']);
  if (pct >= 85) return makeFactor(25, w, 'low',    d, ['docs_good']);
  if (pct >= 70) return makeFactor(55, w, 'medium', d, ['docs_fair']);
  return makeFactor(80, w, 'high', d, ['docs_poor']);
}

function scoreCountryRisk(countryCode: string): RiskFactor {
  const w = WEIGHTS.countryRisk;
  const score = COUNTRY_RISK_SCORE[countryCode.toUpperCase()] ?? DEFAULT_COUNTRY_RISK;
  const level: RiskLevel = score >= 95 ? 'critical' : score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  return makeFactor(score, w, level, `Country ${countryCode.toUpperCase()} risk tier`, [`country_${level}`]);
}

function levelFromScore(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function isCbamRelevant(hsCodes: string[] | undefined): boolean {
  if (!hsCodes || hsCodes.length === 0) return false;
  return hsCodes.some(
    (code) =>
      CBAM_HS_PREFIXES.some((p) => code.startsWith(p)) ||
      CBAM_HS_CHAPTERS.includes(code.slice(0, 2)),
  );
}

function computeLookbackDays(txns: ScoreSupplierInput['transactions']): number {
  const times = txns.map((t) => Date.parse(t.date)).filter((n) => !Number.isNaN(n));
  if (times.length === 0) return 0;
  return Math.max(0, Math.round((Date.now() - Math.min(...times)) / 86_400_000));
}

/** The deterministic core, shared by score_supplier and get_supplier_profile. */
function computeSupplierRisk(input: ScoreSupplierInput): Omit<SupplierRiskResult, 'auditId' | 'summary'> {
  const onTimeDelivery     = scoreOnTimeDelivery(input.transactions);
  const qualityConsistency = scoreQualityConsistency(input.transactions);
  const complianceHistory  = scoreComplianceHistory(input.transactions);
  const documentAccuracy   = scoreDocumentAccuracy(input.transactions);
  const countryRisk        = scoreCountryRisk(input.countryCode);

  const factors = [onTimeDelivery, qualityConsistency, complianceHistory, documentAccuracy, countryRisk];

  const riskScore = Math.round(
    onTimeDelivery.score     * WEIGHTS.onTimeDelivery +
    qualityConsistency.score * WEIGHTS.qualityConsistency +
    complianceHistory.score  * WEIGHTS.complianceHistory +
    documentAccuracy.score   * WEIGHTS.documentAccuracy +
    countryRisk.score        * WEIGHTS.countryRisk,
  );

  const hasCritical = factors.some((f) => f.level === 'critical');
  const hasHigh     = factors.some((f) => f.level === 'high');

  let recommendation: SupplierRecommendation;
  if (riskScore >= 80 || countryRisk.score >= 95)       recommendation = 'reject';
  else if (riskScore >= 60 || hasCritical)              recommendation = 'probation';
  else if (riskScore >= 30 || hasHigh)                  recommendation = 'review';
  else                                                  recommendation = 'approve';

  const sanctionsFlagged = countryRisk.score >= 95;
  const sanctions: SupplierSanctionsCheck = {
    checked: true,
    flagged: sanctionsFlagged,
    ...(sanctionsFlagged ? { matchedList: 'OFAC-adjacent (heuristic — not a live OFAC query)' } : {}),
  };

  return {
    riskScore,
    riskLevel: levelFromScore(riskScore),
    recommendation,
    breakdown: { onTimeDelivery, qualityConsistency, complianceHistory, documentAccuracy, countryRisk },
    sanctions,
    cbamRelevant: isCbamRelevant(input.hsCodesTraded),
    transactionCount: input.transactions.length,
    lookbackDays: computeLookbackDays(input.transactions),
  };
}

export class SupplierRiskMCP extends BaseMCPServer {
  readonly name    = 'supplier-risk';
  readonly version = '1.0.0';

  readonly tools: ToolDefinition[] = [
    {
      name: 'score_supplier',
      description:
        'Score a supplier 0-100 from historical transaction data. Returns a weighted per-factor breakdown ' +
        '(on-time delivery, quality, compliance, documentation, country risk), a recommendation ' +
        '(approve/review/probation/reject), a sanctions heuristic, and a CBAM relevance flag. Deterministic; ' +
        'an optional model-generated summary is added only for substantial, elevated-risk profiles.',
      inputSchema: {
        type: 'object',
        properties: {
          supplierId:      { type: 'string' },
          supplierName:    { type: 'string' },
          countryCode:     { type: 'string', description: 'ISO 3166-1 alpha-2' },
          transactions:    { type: 'array', items: { type: 'object' } },
          certifications:  { type: 'array', items: { type: 'string' } },
          yearsInBusiness: { type: 'number' },
          hsCodesTraded:   { type: 'array', items: { type: 'string' } },
        },
        required: ['supplierId', 'supplierName', 'countryCode', 'transactions'],
      },
    },
    {
      name: 'get_supplier_profile',
      description:
        'Quick gate check — returns only riskLevel, recommendation, sanctions, and CBAM relevance without the ' +
        'full factor breakdown. Same input as score_supplier.',
      inputSchema: {
        type: 'object',
        properties: {
          supplierId:    { type: 'string' },
          supplierName:  { type: 'string' },
          countryCode:   { type: 'string' },
          transactions:  { type: 'array', items: { type: 'object' } },
          hsCodesTraded: { type: 'array', items: { type: 'string' } },
        },
        required: ['supplierId', 'supplierName', 'countryCode', 'transactions'],
      },
    },
    {
      name: 'list_certifications',
      description: 'Reference: the certification codes Progue recognizes and their descriptions.',
      inputSchema: { type: 'object', properties: {} },
    },
  ];

  constructor() {
    super();
    registerSupplierRiskSchemas();
  }

  async executeTool(toolName: string, input: unknown, ctx: ToolCallContext): Promise<ToolCallResult> {
    this.assertToolExists(toolName);
    const log = logger.child({ tool: toolName, tenantId: ctx.tenantId });
    log.info('supplier-risk.tool.start');

    switch (toolName) {
      case 'score_supplier':        return this.scoreSupplier(input, ctx);
      case 'get_supplier_profile':  return this.getSupplierProfile(input, ctx);
      case 'list_certifications':   return { success: true, data: { certifications: CERTIFICATIONS } };
      default:                      throw new Error(`Unhandled tool: ${toolName}`);
    }
  }

  private async scoreSupplier(input: unknown, ctx: ToolCallContext): Promise<ToolCallResult> {
    const parsed = ScoreSupplierInputSchema.parse(input);
    const base = computeSupplierRisk(parsed);

    let summary: string | undefined;
    if (parsed.transactions.length >= SUMMARY_MIN_TRANSACTIONS && base.riskScore >= SUMMARY_MIN_SCORE) {
      summary = await this.generateSummary(parsed, base, ctx);
    }

    const auditId = randomUUID();
    const result: SupplierRiskResult = { ...base, auditId, ...(summary ? { summary } : {}) };

    await writeAuditEvent({
      tenantId:   ctx.tenantId,
      action:     AuditAction.TOOL_CALL,
      entityType: 'supplier_risk',
      entityId:   auditId,
      payload:    { module: 'SUPPLIER_RISK', input: parsed, result },
    });

    return { success: true, data: result };
  }

  private async getSupplierProfile(input: unknown, ctx: ToolCallContext): Promise<ToolCallResult> {
    const parsed = ScoreSupplierInputSchema.parse(input);
    const base = computeSupplierRisk(parsed);
    const auditId = randomUUID();

    await writeAuditEvent({
      tenantId:   ctx.tenantId,
      action:     AuditAction.TOOL_CALL,
      entityType: 'supplier_profile',
      entityId:   auditId,
      payload:    { module: 'SUPPLIER_RISK', input: parsed, riskLevel: base.riskLevel, recommendation: base.recommendation },
    });

    const profile: SupplierProfileResult = {
      riskLevel:      base.riskLevel,
      recommendation: base.recommendation,
      sanctions:      base.sanctions,
      cbamRelevant:   base.cbamRelevant,
    };
    return { success: true, data: profile };
  }

  /** Best-effort contextual summary — never blocks the deterministic score. */
  private async generateSummary(
    parsed: ScoreSupplierInput,
    base: Omit<SupplierRiskResult, 'auditId' | 'summary'>,
    ctx: ToolCallContext,
  ): Promise<string | undefined> {
    try {
      const response = await trackedCall(
        { tenantId: ctx.tenantId, mcpServer: this.name, toolName: 'score_supplier', model: SUMMARY_MODEL, tier: ctx.tier },
        () =>
          anthropic.messages.create({
            model: SUMMARY_MODEL,
            max_tokens: 220,
            stream: false,
            messages: [
              {
                role: 'user',
                content:
                  `Write a 2-3 sentence risk summary for supplier "${parsed.supplierName}" (${parsed.countryCode}). ` +
                  `Composite risk score ${base.riskScore}/100, recommendation "${base.recommendation}". ` +
                  `Factor scores — on-time: ${base.breakdown.onTimeDelivery.score}, quality: ${base.breakdown.qualityConsistency.score}, ` +
                  `compliance: ${base.breakdown.complianceHistory.score}, documentation: ${base.breakdown.documentAccuracy.score}, ` +
                  `country: ${base.breakdown.countryRisk.score}. Be specific and factual; no preamble.`,
              },
            ],
          }),
      );
      const first = response.content[0];
      return first && first.type === 'text' ? first.text.trim() : undefined;
    } catch (err) {
      logger.warn({ err, tenantId: ctx.tenantId }, 'supplier-risk.summary_failed');
      return undefined;
    }
  }
}
