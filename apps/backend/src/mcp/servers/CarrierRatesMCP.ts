import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@anthropic-ai/sdk/resources/messages';

import { trackedCall, type ModelName } from '../../lib/cost-tracker.js';
import logger from '../../lib/logger.js';
import { BaseMCPServer } from '../BaseMCPServer.js';
import type { ToolCallContext, ToolCallResult, ToolDefinition } from '../types.js';
import {
  CompareCarrierOptionsInput,
  CompareCarrierOptionsOutput,
  GetCarrierRatesInput,
  GetCarrierRatesOutput,
  RecommendCarrierInput,
  RecommendCarrierOutput,
  registerCarrierSchemas,
} from './schemas/carrier.schemas.js';

// ---- Model routing (fixed — not caller-configurable) ----
const MODEL_ROUTING = {
  get_carrier_rates:       'claude-haiku-4-5-20251001',
  compare_carrier_options: 'claude-sonnet-4-6',
  recommend_carrier:       'claude-sonnet-4-6',
} as const satisfies Record<string, ModelName>;

type CarrierToolName = keyof typeof MODEL_ROUTING;

const anthropic = new Anthropic();

/** Strip markdown code fences that some model outputs wrap around JSON. */
function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}

/**
 * Carrier Rates MCP Server.
 *
 * Three tools for freight carrier selection:
 *   1. get_carrier_rates       — structured rate quotes per carrier   (haiku)
 *   2. compare_carrier_options — scored cost/speed comparison          (sonnet)
 *   3. recommend_carrier       — weighted recommendation w/ rationale  (sonnet)
 *
 * All Claude calls go through trackedCall() — never raw anthropic.messages.create.
 * Model routing is locked server-side and cannot be overridden by callers.
 */
export class CarrierRatesMCP extends BaseMCPServer {
  readonly name    = 'carrier-rates';
  readonly version = '1.0.0';

  readonly tools: ToolDefinition[] = [
    {
      name:        'get_carrier_rates',
      description:
        'Retrieve freight rate estimates for a shipment across available carriers. Returns structured quotes with cost, transit time, and service level for each carrier.',
      inputSchema: {
        type: 'object',
        properties: {
          originCountry:        { type: 'string', description: 'ISO 3166-1 alpha-2 origin country' },
          destinationCountry:   { type: 'string', description: 'ISO 3166-1 alpha-2 destination country' },
          weightKg:             { type: 'number', description: 'Shipment weight in kilograms' },
          dimensions:           { type: 'object', description: 'Length/width/height in cm' },
          commodityDescription: { type: 'string', description: 'Description of goods being shipped' },
          incoterms:            { type: 'string', enum: ['EXW', 'FOB', 'CIF', 'DAP', 'DDP', 'FCA'] },
          requiredServiceLevel: {
            type: 'string',
            enum: ['EXPRESS', 'STANDARD', 'ECONOMY', 'FREIGHT', 'ANY'],
          },
          carriers: { type: 'array', items: { type: 'string' } },
        },
        required: ['originCountry', 'destinationCountry', 'weightKg'],
      },
    },
    {
      name:        'compare_carrier_options',
      description:
        'Analyse and score multiple carrier quotes on cost and speed dimensions. Returns a ranked comparison with pros/cons for each option.',
      inputSchema: {
        type: 'object',
        properties: {
          quotes:          { type: 'array', description: 'Carrier quotes from get_carrier_rates' },
          shipmentContext: { type: 'object', description: 'Shipment details for context-aware scoring' },
        },
        required: ['quotes', 'shipmentContext'],
      },
    },
    {
      name:        'recommend_carrier',
      description:
        'Produce a weighted carrier recommendation given cost/speed priorities and business constraints. Returns top pick with rationale and up to 2 alternatives.',
      inputSchema: {
        type: 'object',
        properties: {
          quotes:          { type: 'array', description: 'Carrier quotes to choose from' },
          priorities:      { type: 'object', description: 'costWeight and speedWeight (must sum to ≤ 1.0)' },
          constraints:     { type: 'object', description: 'Budget cap, deadline, carrier inclusion/exclusion' },
          businessContext: { type: 'string', description: 'Free-text business context (SLA, urgency, etc.)' },
        },
        required: ['quotes', 'priorities'],
      },
    },
  ];

  constructor() {
    super();
    registerCarrierSchemas();
  }

  async executeTool(
    toolName: string,
    input: unknown,
    ctx: ToolCallContext,
  ): Promise<ToolCallResult> {
    this.assertToolExists(toolName);

    const model = MODEL_ROUTING[toolName as CarrierToolName];
    const log   = logger.child({ tool: toolName, model, tenantId: ctx.tenantId });

    log.info('carrier.tool.start');

    try {
      switch (toolName as CarrierToolName) {
        case 'get_carrier_rates':
          return await this.getCarrierRates(input, ctx, model);
        case 'compare_carrier_options':
          return await this.compareCarrierOptions(input, ctx, model);
        case 'recommend_carrier':
          return await this.recommendCarrier(input, ctx, model);
      }
    } catch (err) {
      log.error({ err }, 'carrier.tool.error');
      throw err;
    }
  }

  // ---- Tool implementations ----

  private async getCarrierRates(
    input: unknown,
    ctx: ToolCallContext,
    model: ModelName,
  ): Promise<ToolCallResult> {
    const parsed = GetCarrierRatesInput.parse(input);

    const response = await trackedCall(
      {
        tenantId:  ctx.tenantId,
        mcpServer: this.name,
        toolName:  'get_carrier_rates',
        model,
        tier:      ctx.tier,
      },
      () =>
        anthropic.messages.create({
          stream:     false,
          model,
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                'Generate realistic freight carrier rate quotes for this shipment.',
                'Return ONLY valid JSON — no prose, no markdown fences.\n',
                'SHIPMENT:',
                `- Origin: ${parsed.originCountry}${parsed.originCity ? ` (${parsed.originCity})` : ''}`,
                `- Destination: ${parsed.destinationCountry}${parsed.destinationCity ? ` (${parsed.destinationCity})` : ''}`,
                `- Weight: ${parsed.weightKg}kg`,
                parsed.dimensions
                  ? `- Dimensions: ${parsed.dimensions.lengthCm}×${parsed.dimensions.widthCm}×${parsed.dimensions.heightCm}cm`
                  : '',
                parsed.commodityDescription ? `- Commodity: ${parsed.commodityDescription}` : '',
                parsed.incoterms ? `- Incoterms: ${parsed.incoterms}` : '',
                `- Required service level: ${parsed.requiredServiceLevel}`,
                parsed.carriers?.length
                  ? `- Specific carriers: ${parsed.carriers.join(', ')}`
                  : '- All available carriers',
                '\nReturn JSON: { quotes: [{carrierId, carrierName, serviceLevel, totalCostUsd,',
                'transitDays, currency, notes}], currency, quotedAt (ISO 8601),',
                'cheapestCarrierId, fastestCarrierId }',
              ]
                .filter(Boolean)
                .join('\n'),
            },
          ],
        }),
    );

    return this.parseAndValidate(response, GetCarrierRatesOutput, model);
  }

  private async compareCarrierOptions(
    input: unknown,
    ctx: ToolCallContext,
    model: ModelName,
  ): Promise<ToolCallResult> {
    const parsed = CompareCarrierOptionsInput.parse(input);

    const response = await trackedCall(
      {
        tenantId:  ctx.tenantId,
        mcpServer: this.name,
        toolName:  'compare_carrier_options',
        model,
        tier:      ctx.tier,
      },
      () =>
        anthropic.messages.create({
          stream:     false,
          model,
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: [
                'Compare these carrier quotes and score them on cost (10 = cheapest) and',
                'speed (10 = fastest). Return ONLY valid JSON.\n',
                'SHIPMENT CONTEXT:',
                JSON.stringify(parsed.shipmentContext, null, 2),
                '\nQUOTES:',
                JSON.stringify(parsed.quotes, null, 2),
                '\nReturn JSON: { comparison: [{carrierId, carrierName, costScore, speedScore,',
                'overallScore, pros (array), cons (array)}], summary (one sentence) }',
              ].join('\n'),
            },
          ],
        }),
    );

    return this.parseAndValidate(response, CompareCarrierOptionsOutput, model);
  }

  private async recommendCarrier(
    input: unknown,
    ctx: ToolCallContext,
    model: ModelName,
  ): Promise<ToolCallResult> {
    const parsed = RecommendCarrierInput.parse(input);

    const response = await trackedCall(
      {
        tenantId:  ctx.tenantId,
        mcpServer: this.name,
        toolName:  'recommend_carrier',
        model,
        tier:      ctx.tier,
      },
      () =>
        anthropic.messages.create({
          stream:     false,
          model,
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: [
                'Recommend the best carrier given these priorities and constraints.',
                'Return ONLY valid JSON.\n',
                'PRIORITIES:',
                `- Cost weight: ${parsed.priorities.costWeight} (0=ignore, 1=everything)`,
                `- Speed weight: ${parsed.priorities.speedWeight}`,
                parsed.priorities.reliabilityWeight != null
                  ? `- Reliability weight: ${parsed.priorities.reliabilityWeight}`
                  : '',
                parsed.constraints
                  ? `\nCONSTRAINTS:\n${JSON.stringify(parsed.constraints, null, 2)}`
                  : '',
                parsed.businessContext
                  ? `\nBUSINESS CONTEXT: ${parsed.businessContext}`
                  : '',
                '\nAVAILABLE QUOTES:',
                JSON.stringify(parsed.quotes, null, 2),
                '\nReturn JSON: { recommendedCarrierId, recommendedCarrierName,',
                'confidence (0-1), rationale (2-3 sentences),',
                'alternatives (max 2: [{carrierId, carrierName, reason}]),',
                'warnings (array, optional) }',
              ]
                .filter(Boolean)
                .join('\n'),
            },
          ],
        }),
    );

    return this.parseAndValidate(response, RecommendCarrierOutput, model);
  }

  // ---- Private helpers ----

  /**
   * Parse the model's text output through a Zod schema.
   * Returns success:false (never throws) on non-JSON or schema mismatch.
   */
  private parseAndValidate<T>(
    response: Message,
    schema: {
      safeParse: (
        v: unknown,
      ) =>
        | { success: true; data: T }
        | { success: false; error: { flatten: () => unknown } };
    },
    model: ModelName,
  ): ToolCallResult {
    const first   = response.content[0];
    const rawText = first?.type === 'text' ? first.text : '';
    const jsonText = stripCodeFences(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return {
        success: false,
        data:    { error: 'Model returned non-JSON response', raw: rawText },
      };
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      return {
        success: false,
        data:    { error: 'Output schema mismatch', issues: result.error.flatten() },
      };
    }

    return {
      success: true,
      data:    result.data,
      meta: {
        model,
        tokensUsed:
          (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0),
      },
    };
  }
}
