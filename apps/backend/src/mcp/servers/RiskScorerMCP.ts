import { randomUUID } from 'crypto';

import { AuditAction } from '@prompturtle/shared';
import type {
  RiskFactor,
  RiskLevel,
  RiskRecommendation,
  ShipmentRiskResult,
} from '@prompturtle/shared';

import { writeAuditEvent } from '../../lib/audit.js';
import logger from '../../lib/logger.js';
import { BaseMCPServer } from '../BaseMCPServer.js';
import type { ToolCallContext, ToolCallResult, ToolDefinition } from '../types.js';
import {
  ScoreShipmentInput as ScoreShipmentInputSchema,
  registerRiskScorerSchemas,
  type ScoreShipmentInput,
} from './schemas/risk-scorer.schemas.js';

// Default shipment cost threshold (USD) above which a high-cost guardrail fires.
// Mirrors THRESHOLDS.HIGH_SHIPMENT_COST in lib/approval.ts.
const DEFAULT_COST_THRESHOLD_USD = 10_000;

// ---- Factor weights (sum to 1.0) ----
const WEIGHTS = {
  htsConfidence: 0.25,
  complianceFlags: 0.30,
  carrierApproval: 0.20,
  costThreshold: 0.15,
  customsReadiness: 0.10,
} as const;

/** Maps a 0-100 factor/composite score onto the shared risk bands. */
function levelFromScore(score: number): RiskLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function makeFactor(score: number, weight: number, detail: string, signals: string[]): RiskFactor {
  return { score, weight, level: levelFromScore(score), detail, signals };
}

function scoreHtsConfidence(htsResult: ScoreShipmentInput['htsResult']): RiskFactor {
  const weight = WEIGHTS.htsConfidence;

  if (!htsResult || (htsResult.hsCode === undefined && htsResult.confidence === undefined)) {
    return makeFactor(50, weight, 'No HTS classification result was provided', ['hts_not_evaluated']);
  }

  const { hsCode, confidence } = htsResult;

  if (confidence === undefined) {
    return makeFactor(
      40,
      weight,
      `HTS code ${hsCode ?? 'unknown'} present without a confidence score`,
      ['hts_confidence_missing'],
    );
  }

  if (confidence >= 0.85) {
    return makeFactor(0, weight, `HTS classification confidence ${confidence} is high`, ['hts_confidence_high']);
  }
  if (confidence >= 0.70) {
    return makeFactor(35, weight, `HTS classification confidence ${confidence} is moderate`, ['hts_confidence_moderate']);
  }
  if (confidence >= 0.50) {
    return makeFactor(65, weight, `HTS classification confidence ${confidence} is low`, ['hts_confidence_low']);
  }
  return makeFactor(90, weight, `HTS classification confidence ${confidence} is very low`, ['hts_confidence_very_low']);
}

function scoreComplianceFlags(flags: ScoreShipmentInput['complianceFlags']): RiskFactor {
  const weight = WEIGHTS.complianceFlags;

  if (!flags || flags.length === 0) {
    return makeFactor(0, weight, 'No compliance flags were raised', ['compliance_clean']);
  }

  const signals = flags.map((f) => f.code);
  const severities = new Set(flags.map((f) => f.severity));

  if (severities.has('critical')) {
    return makeFactor(95, weight, 'At least one critical compliance flag was raised', signals);
  }
  if (severities.has('warning')) {
    return makeFactor(45, weight, 'At least one compliance warning was raised', signals);
  }
  return makeFactor(10, weight, 'Only informational compliance flags were raised', signals);
}

function scoreCarrierApproval(carrierResult: ScoreShipmentInput['carrierResult']): RiskFactor {
  const weight = WEIGHTS.carrierApproval;
  const signals: string[] = [];
  let score: number;
  let detail: string;

  if (!carrierResult || carrierResult.isApprovedCarrier === undefined) {
    score = 20;
    detail = 'No carrier approval result was provided';
    signals.push('carrier_not_evaluated');
  } else if (carrierResult.isApprovedCarrier) {
    score = 0;
    detail = `Carrier ${carrierResult.carrier ?? 'unknown'} is on the approved carrier list`;
    signals.push('carrier_approved');
  } else {
    score = 60;
    detail = `Carrier ${carrierResult.carrier ?? 'unknown'} is not on the approved carrier list`;
    signals.push('carrier_unapproved', 'new_carrier_check');
  }

  if (carrierResult?.score !== undefined && carrierResult.score < 50) {
    score = Math.min(100, score + 20);
    signals.push('carrier_score_low');
    detail += `; carrier reliability score ${carrierResult.score} is below 50`;
  }

  return makeFactor(score, weight, detail, signals);
}

function scoreCostThreshold(shipmentCost: ScoreShipmentInput['shipmentCost']): RiskFactor {
  const weight = WEIGHTS.costThreshold;

  if (!shipmentCost) {
    return makeFactor(0, weight, 'No shipment cost was provided', ['cost_not_evaluated']);
  }

  const { total, currency } = shipmentCost;
  const ratio = total / DEFAULT_COST_THRESHOLD_USD;

  if (ratio <= 0.5) {
    return makeFactor(0, weight, `Shipment cost ${total} ${currency} is well below the $${DEFAULT_COST_THRESHOLD_USD} threshold`, ['cost_low']);
  }
  if (ratio <= 0.8) {
    return makeFactor(20, weight, `Shipment cost ${total} ${currency} is approaching the $${DEFAULT_COST_THRESHOLD_USD} threshold`, ['cost_moderate']);
  }
  if (ratio <= 1.0) {
    return makeFactor(55, weight, `Shipment cost ${total} ${currency} is near the $${DEFAULT_COST_THRESHOLD_USD} threshold`, ['cost_near_threshold']);
  }
  return makeFactor(
    90,
    weight,
    `Shipment cost ${total} ${currency} exceeds the $${DEFAULT_COST_THRESHOLD_USD} threshold`,
    ['cost_exceeds_threshold', 'high_cost_approval'],
  );
}

function scoreCustomsReadiness(
  customsRequired: ScoreShipmentInput['customsRequired'],
  customsBroker: ScoreShipmentInput['customsBroker'],
): RiskFactor {
  const weight = WEIGHTS.customsReadiness;

  if (!customsRequired) {
    return makeFactor(0, weight, 'Customs clearance is not required for this shipment', ['customs_not_required']);
  }

  if (!customsBroker) {
    return makeFactor(50, weight, 'Customs clearance is required but no broker is on file', ['customs_broker_missing']);
  }

  if (customsBroker.verified) {
    return makeFactor(10, weight, `Customs broker ${customsBroker.name ?? 'unknown'} is verified`, ['customs_broker_verified']);
  }

  return makeFactor(
    80,
    weight,
    `Customs broker ${customsBroker.name ?? 'unknown'} is unverified`,
    ['customs_broker_unverified', 'customs_flag'],
  );
}

export class RiskScorerMCP extends BaseMCPServer {
  readonly name = 'risk-scorer';
  readonly version = '1.0.0';

  readonly tools: ToolDefinition[] = [
    {
      name: 'score_shipment',
      description:
        'Compute a cross-module shipment risk score (0-100) by synthesizing HTS classification confidence, ' +
        'BOL compliance flags, carrier approval status, shipment cost, and customs readiness. ' +
        'Returns a weighted score, risk level, recommendation, and per-factor breakdown. ' +
        'Pure computation — no LLM call. Always writes an audit record, including on halted decisions.',
      inputSchema: {
        type: 'object',
        properties: {
          bolType: { type: 'string', enum: ['TRUCK_BOL', 'AIR_WAYBILL', 'OCEAN_BOL'] },
          bol: { type: 'object', description: 'Parsed BOL document (any of the supported BOL types)' },
          htsResult: {
            type: 'object',
            properties: {
              hsCode: { type: 'string' },
              confidence: { type: 'number' },
              dutyRate: { type: 'string' },
            },
          },
          carrierResult: {
            type: 'object',
            properties: {
              carrier: { type: 'string' },
              isApprovedCarrier: { type: 'boolean' },
              score: { type: 'number' },
            },
          },
          shipmentCost: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              currency: { type: 'string' },
            },
          },
          customsBroker: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              verified: { type: 'boolean' },
            },
          },
          customsRequired: { type: 'boolean' },
          complianceFlags: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
                message: { type: 'string' },
                field: { type: 'string' },
              },
            },
          },
        },
      },
    },
  ];

  constructor() {
    super();
    registerRiskScorerSchemas();
  }

  async executeTool(
    toolName: string,
    input: unknown,
    ctx: ToolCallContext,
  ): Promise<ToolCallResult> {
    this.assertToolExists(toolName);

    const log = logger.child({ tool: toolName, tenantId: ctx.tenantId });
    log.info('risk-scorer.tool.start');

    switch (toolName) {
      case 'score_shipment':
        return await this.scoreShipment(input, ctx);
      default:
        throw new Error(`Unhandled tool: ${toolName}`);
    }
  }

  private async scoreShipment(input: unknown, ctx: ToolCallContext): Promise<ToolCallResult> {
    const parsed = ScoreShipmentInputSchema.parse(input);

    const htsConfidence = scoreHtsConfidence(parsed.htsResult);
    const complianceFlags = scoreComplianceFlags(parsed.complianceFlags);
    const carrierApproval = scoreCarrierApproval(parsed.carrierResult);
    const costThreshold = scoreCostThreshold(parsed.shipmentCost);
    const customsReadiness = scoreCustomsReadiness(parsed.customsRequired, parsed.customsBroker);

    const factors = [htsConfidence, complianceFlags, carrierApproval, costThreshold, customsReadiness];

    const riskScore = Math.round(
      htsConfidence.score * WEIGHTS.htsConfidence +
        complianceFlags.score * WEIGHTS.complianceFlags +
        carrierApproval.score * WEIGHTS.carrierApproval +
        costThreshold.score * WEIGHTS.costThreshold +
        customsReadiness.score * WEIGHTS.customsReadiness,
    );
    const riskLevel = levelFromScore(riskScore);

    const hasCritical = factors.some((f) => f.level === 'critical');
    const hasHigh = factors.some((f) => f.level === 'high');

    let recommendation: RiskRecommendation;
    let decision: ShipmentRiskResult['decision'];
    if (hasCritical) {
      recommendation = 'halt';
      decision = 'halted';
    } else if (riskScore >= 60 || hasHigh) {
      recommendation = 'review';
      decision = 'escalated';
    } else {
      recommendation = 'proceed';
      decision = 'accepted';
    }

    const allSignals = new Set(factors.flatMap((f) => f.signals));
    const guardrailsFired = ['audit_trail'];
    if (allSignals.has('high_cost_approval')) guardrailsFired.push('high_cost_approval');
    if (allSignals.has('customs_flag')) guardrailsFired.push('customs_flag');
    if (allSignals.has('new_carrier_check')) guardrailsFired.push('new_carrier_check');

    const auditId = randomUUID();

    const result: ShipmentRiskResult = {
      riskScore,
      riskLevel,
      recommendation,
      breakdown: { htsConfidence, complianceFlags, carrierApproval, costThreshold, customsReadiness },
      guardrailsFired,
      auditId,
      decision,
    };

    await writeAuditEvent({
      tenantId: ctx.tenantId,
      action: AuditAction.TOOL_CALL,
      entityType: 'risk_score',
      entityId: auditId,
      payload: { module: 'RISK_SCORING', input: parsed, result },
    });

    return { success: true, data: result };
  }
}
