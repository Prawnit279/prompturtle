import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@anthropic-ai/sdk/resources/messages';

import { trackedCall, type ModelName } from '../../lib/cost-tracker.js';
import logger from '../../lib/logger.js';
import { BaseMCPServer } from '../BaseMCPServer.js';
import type { ToolCallContext, ToolCallResult, ToolDefinition } from '../types.js';
import {
  ExtractBolFieldsInput,
  ExtractBolFieldsOutput,
  FlagBolDiscrepanciesInput,
  FlagBolDiscrepanciesOutput,
  ValidateBolDataInput,
  ValidateBolDataOutput,
  registerBolSchemas,
} from './schemas/bol.schemas.js';

// ---- Model routing (fixed — not caller-configurable) ----
// Routing is a product decision: sonnet for extraction, haiku for validation,
// opus for complex cross-document comparison.
const MODEL_ROUTING = {
  extract_bol_fields:      'claude-sonnet-4-6',
  validate_bol_data:       'claude-haiku-4-5-20251001',
  flag_bol_discrepancies:  'claude-opus-4-6',
} as const satisfies Record<string, ModelName>;

type BolToolName = keyof typeof MODEL_ROUTING;

const anthropic = new Anthropic();

/** Strip markdown code fences that some model outputs include around JSON. */
function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}

/**
 * BOL Processor MCP Server.
 *
 * Provides three tools for supply chain operators working with Bills of Lading:
 *   1. extract_bol_fields   — parse raw BOL text → structured fields  (sonnet)
 *   2. validate_bol_data    — check fields against business rules       (haiku)
 *   3. flag_bol_discrepancies — compare BOL vs PO/shipment record       (opus)
 *
 * All Claude calls go through trackedCall() — never raw anthropic.messages.create.
 * Model routing is locked at the server level and cannot be overridden by callers.
 */
export class BolProcessorMCP extends BaseMCPServer {
  readonly name    = 'bol-processor';
  readonly version = '1.0.0';

  readonly tools: ToolDefinition[] = [
    {
      name:        'extract_bol_fields',
      description: 'Parse raw Bill of Lading text and extract structured fields including shipper, consignee, ports, dates, container numbers, and freight terms.',
      inputSchema: {
        type: 'object',
        properties: {
          rawText:     { type: 'string', description: 'Raw BOL text content (OCR output, PDF text, or manual entry)' },
          carrierHint: { type: 'string', description: 'Optional carrier name hint to improve extraction accuracy' },
        },
        required: ['rawText'],
      },
    },
    {
      name:        'validate_bol_data',
      description: 'Validate extracted BOL fields against supply chain business rules. Returns errors, warnings, and missing required fields.',
      inputSchema: {
        type: 'object',
        properties: {
          bolFields:  { type: 'object', description: 'Extracted BOL fields from extract_bol_fields' },
          strictness: { type: 'string', enum: ['lenient', 'standard', 'strict'], description: 'Validation strictness level (default: standard)' },
        },
        required: ['bolFields'],
      },
    },
    {
      name:        'flag_bol_discrepancies',
      description: 'Compare a BOL against a purchase order or shipment record. Identifies mismatches in quantities, weights, destinations, and dates. Returns severity-ranked discrepancies and a recommended action.',
      inputSchema: {
        type: 'object',
        properties: {
          bolFields:    { type: 'object', description: 'Extracted BOL fields' },
          referenceDoc: { type: 'object', description: 'PO or shipment record to compare against' },
          referenceType: {
            type: 'string',
            enum: ['PURCHASE_ORDER', 'SHIPMENT_RECORD', 'INVOICE'],
            description: 'Type of reference document',
          },
        },
        required: ['bolFields', 'referenceDoc', 'referenceType'],
      },
    },
  ];

  constructor() {
    super();
    registerBolSchemas();
  }

  async executeTool(
    toolName: string,
    input: unknown,
    ctx: ToolCallContext,
  ): Promise<ToolCallResult> {
    this.assertToolExists(toolName);

    const model = MODEL_ROUTING[toolName as BolToolName];
    const log   = logger.child({ tool: toolName, model, tenantId: ctx.tenantId });

    log.info('bol.tool.start');

    try {
      switch (toolName as BolToolName) {
        case 'extract_bol_fields':
          return await this.extractBolFields(input, ctx, model);
        case 'validate_bol_data':
          return await this.validateBolData(input, ctx, model);
        case 'flag_bol_discrepancies':
          return await this.flagBolDiscrepancies(input, ctx, model);
      }
    } catch (err) {
      log.error({ err }, 'bol.tool.error');
      throw err;
    }
  }

  // ---- Tool implementations ----

  private async extractBolFields(
    input: unknown,
    ctx: ToolCallContext,
    model: ModelName,
  ): Promise<ToolCallResult> {
    const parsed = ExtractBolFieldsInput.parse(input);

    const response = await trackedCall(
      {
        tenantId:  ctx.tenantId,
        mcpServer: this.name,
        toolName:  'extract_bol_fields',
        model,
        tier:      ctx.tier,
      },
      () =>
        anthropic.messages.create({
          // stream: false is the default — return type is Message, not Stream
          stream: false,
          model,
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                'Extract all structured fields from this Bill of Lading document.',
                'Return ONLY valid JSON matching the schema. Omit any field you cannot determine.',
                'Include extractionConfidence (0–1) based on text clarity.\n',
                parsed.carrierHint ? `Carrier hint: ${parsed.carrierHint}\n` : '',
                'BOL TEXT:\n',
                parsed.rawText,
                '\n\nReturn JSON with these optional fields (extractionConfidence is required):',
                'bolNumber, shipperName, consigneeName, originPort, destinationPort,',
                'carrierName, vesselName, departureDate (ISO 8601), arrivalDate (ISO 8601),',
                'commodityCode, grossWeightKg (number), packageCount (integer),',
                'containerNumbers (string array), freightTerms (PREPAID|COLLECT|THIRD_PARTY),',
                'extractionConfidence (0–1)',
              ]
                .filter(Boolean)
                .join('\n'),
            },
          ],
        }),
    );

    return this.parseModelOutput(response, ExtractBolFieldsOutput, model);
  }

  private async validateBolData(
    input: unknown,
    ctx: ToolCallContext,
    model: ModelName,
  ): Promise<ToolCallResult> {
    const parsed = ValidateBolDataInput.parse(input);

    const response = await trackedCall(
      {
        tenantId:  ctx.tenantId,
        mcpServer: this.name,
        toolName:  'validate_bol_data',
        model,
        tier:      ctx.tier,
      },
      () =>
        anthropic.messages.create({
          stream: false,
          model,
          max_tokens: 512,
          messages: [
            {
              role: 'user',
              content: [
                `Validate this Bill of Lading data against standard supply chain requirements.`,
                `Strictness level: ${parsed.strictness}.\n`,
                'BOL FIELDS:',
                JSON.stringify(parsed.bolFields, null, 2),
                '\nReturn ONLY JSON with:',
                '- isValid (boolean)',
                '- errors: array of { field, message, severity: "error"|"warning" }',
                '- missingRequiredFields: array of field name strings\n',
                'Required fields at "standard" strictness:',
                'bolNumber, shipperName, consigneeName, originPort, destinationPort, carrierName.',
              ].join('\n'),
            },
          ],
        }),
    );

    return this.parseModelOutput(response, ValidateBolDataOutput, model);
  }

  private async flagBolDiscrepancies(
    input: unknown,
    ctx: ToolCallContext,
    model: ModelName,
  ): Promise<ToolCallResult> {
    const parsed = FlagBolDiscrepanciesInput.parse(input);

    const response = await trackedCall(
      {
        tenantId:  ctx.tenantId,
        mcpServer: this.name,
        toolName:  'flag_bol_discrepancies',
        model,
        tier:      ctx.tier,
      },
      () =>
        anthropic.messages.create({
          stream: false,
          model,
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: [
                'Compare this Bill of Lading against the reference document and identify all discrepancies.\n',
                'BOL FIELDS:',
                JSON.stringify(parsed.bolFields, null, 2),
                `\nREFERENCE DOCUMENT (${parsed.referenceType}):`,
                JSON.stringify(parsed.referenceDoc, null, 2),
                '\nReturn ONLY JSON with:',
                '- hasDiscrepancies (boolean)',
                '- discrepancies: array of { field, bolValue, referenceValue, severity: "critical"|"major"|"minor", explanation }',
                '- recommendedAction: "APPROVE" | "FLAG_FOR_REVIEW" | "REJECT" | "REQUEST_AMENDMENT"',
                '- summary: one-sentence plain English summary\n',
                'Severity guide:',
                '- critical: wrong destination, wrong consignee, quantity >10% off',
                '- major: date mismatches >3 days, weight discrepancy >5%',
                '- minor: formatting differences, minor description variations',
              ].join('\n'),
            },
          ],
        }),
    );

    return this.parseModelOutput(response, FlagBolDiscrepanciesOutput, model);
  }

  // ---- Private helpers ----

  /**
   * Parse the model's text response through a Zod schema.
   * Returns success:false (never throws) when the model returns non-JSON
   * or when the output does not match the expected schema.
   */
  private parseModelOutput<T>(
    response: Message,
    schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } } },
    model: ModelName,
  ): ToolCallResult {
    const first = response.content[0];
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
        tokensUsed: (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0),
      },
    };
  }
}
