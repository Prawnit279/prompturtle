import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@anthropic-ai/sdk/resources/messages';

import { trackedCall, type ModelName } from '../../lib/cost-tracker.js';
import logger from '../../lib/logger.js';
import { searchHtsCodes } from '../../data/hts-ingest.js';
import { prisma } from '../../lib/db.js';
import { BaseMCPServer } from '../BaseMCPServer.js';
import type { ToolCallContext, ToolCallResult, ToolDefinition } from '../types.js';
import {
  ClassifyProductInput,
  ClassifyProductOutput,
  ValidateClassificationInput,
  ValidateClassificationOutput,
  GetDutyRatesInput,
  GetDutyRatesOutput,
  registerHtsClassifierSchemas,
} from './schemas/hts-classifier.schemas.js';

// ---- Model routing (fixed — not caller-configurable) ----
// classify_product:       Opus  — high-stakes classification requires best reasoning
// validate_classification: Haiku — simpler validation task, cost-efficient
// get_duty_rates:         null  — pure DB lookup, no LLM involved
const MODEL_ROUTING = {
  classify_product:        'claude-opus-4-6',
  validate_classification: 'claude-haiku-4-5-20251001',
} as const satisfies Record<string, ModelName>;

type HtsLlmToolName = keyof typeof MODEL_ROUTING;

const anthropic = new Anthropic();

export class HtsClassifierMCP extends BaseMCPServer {
  readonly name    = 'hts-classifier';
  readonly version = '1.0.0';

  readonly tools: ToolDefinition[] = [
    {
      name: 'classify_product',
      description:
        'Classify a product using its description. Searches HTS code database via semantic similarity, ' +
        'then uses AI to select the best match with confidence score and reasoning.',
      inputSchema: {
        type: 'object',
        properties: {
          productDescription: { type: 'string', description: 'Free-text product description' },
          context:            { type: 'string', description: 'Optional context: material, use case, origin' },
          candidateCount:     { type: 'number', description: 'Number of pgvector candidates to retrieve (default 5)' },
        },
        required: ['productDescription'],
      },
    },
    {
      name: 'validate_classification',
      description:
        'Validate an existing HTS classification. Checks if the code matches the product description ' +
        'and flags potential compliance issues.',
      inputSchema: {
        type: 'object',
        properties: {
          htsCode:            { type: 'string', description: 'HTS code to validate' },
          productDescription: { type: 'string', description: 'Product description to validate against' },
          declaredDutyRate:   { type: 'string', description: 'Optional duty rate to cross-check' },
        },
        required: ['htsCode', 'productDescription'],
      },
    },
    {
      name: 'get_duty_rates',
      description:
        'Look up the duty rate for a specific HTS code. Pure database lookup — no AI involved. ' +
        'Fast and deterministic.',
      inputSchema: {
        type: 'object',
        properties: {
          htsCode: { type: 'string', description: 'HTS code to look up' },
        },
        required: ['htsCode'],
      },
    },
  ];

  constructor() {
    super();
    registerHtsClassifierSchemas();
  }

  async executeTool(
    toolName: string,
    input: unknown,
    ctx: ToolCallContext,
  ): Promise<ToolCallResult> {
    this.assertToolExists(toolName);

    const log = logger.child({ tool: toolName, tenantId: ctx.tenantId });
    log.info('hts-classifier.tool.start');

    try {
      switch (toolName) {
        case 'classify_product':        return await this.classifyProduct(input, ctx);
        case 'validate_classification': return await this.validateClassification(input, ctx);
        case 'get_duty_rates':          return await this.getDutyRates(input);
        default: throw new Error(`Unhandled tool: ${toolName}`);
      }
    } catch (err) {
      log.error({ err }, 'hts-classifier.tool.error');
      throw err;
    }
  }

  // ---- Tool implementations ----

  private async classifyProduct(
    input: unknown,
    ctx: ToolCallContext,
  ): Promise<ToolCallResult> {
    const parsed = ClassifyProductInput.parse(input);
    const model  = MODEL_ROUTING['classify_product' as HtsLlmToolName];

    // Step 1: pgvector similarity search to get candidates
    const query = parsed.context
      ? `${parsed.productDescription} ${parsed.context}`
      : parsed.productDescription;

    const candidates = await searchHtsCodes(query, parsed.candidateCount);

    if (candidates.length === 0) {
      return {
        success: false,
        data: { error: 'No HTS code candidates found in database. Ensure seed:hts has been run.' },
      };
    }

    // Step 2: Opus re-ranks candidates and selects best match
    const candidateText = candidates
      .map(
        (c, i) =>
          `${i + 1}. HTS ${c.code}: ${c.description} (duty: ${c.dutyRate ?? 'Unknown'}, ` +
          `similarity: ${(c.similarity * 100).toFixed(1)}%)`,
      )
      .join('\n');

    const response = await trackedCall(
      {
        tenantId:  ctx.tenantId,
        mcpServer: this.name,
        toolName:  'classify_product',
        model,
        tier:      ctx.tier,
      },
      () =>
        anthropic.messages.create({
          model,
          max_tokens: 1024,
          stream: false,
          messages: [
            {
              role: 'user',
              content:
                `You are an expert in HTS (Harmonized Tariff Schedule) classification. ` +
                `Select the best HTS code for this product from the candidates retrieved via semantic search.\n\n` +
                `PRODUCT DESCRIPTION: ${parsed.productDescription}\n` +
                (parsed.context ? `ADDITIONAL CONTEXT: ${parsed.context}\n` : '') +
                `\nCANDIDATE HTS CODES (from semantic search):\n${candidateText}\n\n` +
                `Select the single best match. Return ONLY valid JSON:\n` +
                `{\n` +
                `  "htsCode": "the selected code",\n` +
                `  "description": "the code description",\n` +
                `  "chapter": "2-digit chapter",\n` +
                `  "dutyRate": "the duty rate",\n` +
                `  "confidence": 0.0-1.0,\n` +
                `  "reasoning": "2-3 sentences explaining why this code is correct",\n` +
                `  "alternativeCodes": [\n` +
                `    {"htsCode": "...", "description": "...", "confidence": 0.0-1.0, "reason": "why runner-up"}\n` +
                `  ],\n` +
                `  "warnings": ["any classification edge cases or compliance notes"]\n` +
                `}`,
            },
          ],
        }),
    );

    return this.parseAndValidate(response as Message, ClassifyProductOutput, model);
  }

  private async validateClassification(
    input: unknown,
    ctx: ToolCallContext,
  ): Promise<ToolCallResult> {
    const parsed = ValidateClassificationInput.parse(input);
    const model  = MODEL_ROUTING['validate_classification' as HtsLlmToolName];

    // Look up the code in DB for ground truth
    const dbRecord = await prisma.htsCode.findUnique({
      where: { code: parsed.htsCode },
    });

    const dbContext = dbRecord
      ? `DB record for ${parsed.htsCode}: "${dbRecord.description}" (duty: ${dbRecord.duty_rate ?? 'unknown'})`
      : `HTS code ${parsed.htsCode} not found in local database — validation based on general knowledge only`;

    const response = await trackedCall(
      {
        tenantId:  ctx.tenantId,
        mcpServer: this.name,
        toolName:  'validate_classification',
        model,
        tier:      ctx.tier,
      },
      () =>
        anthropic.messages.create({
          model,
          max_tokens: 512,
          stream: false,
          messages: [
            {
              role: 'user',
              content:
                `Validate this HTS classification. Flag any compliance issues.\n\n` +
                `HTS CODE: ${parsed.htsCode}\n` +
                `PRODUCT: ${parsed.productDescription}\n` +
                (parsed.declaredDutyRate ? `DECLARED DUTY RATE: ${parsed.declaredDutyRate}\n` : '') +
                `${dbContext}\n\n` +
                `Return ONLY valid JSON:\n` +
                `{\n` +
                `  "isValid": true/false,\n` +
                `  "confidence": 0.0-1.0,\n` +
                `  "issues": [{"severity": "critical|major|minor", "message": "..."}],\n` +
                `  "suggestedCode": "alternative code if wrong (optional)",\n` +
                `  "explanation": "one paragraph summary"\n` +
                `}`,
            },
          ],
        }),
    );

    return this.parseAndValidate(response as Message, ValidateClassificationOutput, model);
  }

  private async getDutyRates(input: unknown): Promise<ToolCallResult> {
    // Pure DB lookup — no LLM, no trackedCall
    const parsed = GetDutyRatesInput.parse(input);

    const record = await prisma.htsCode.findUnique({
      where: { code: parsed.htsCode },
    });

    if (!record) {
      const notFound: GetDutyRatesOutput = {
        htsCode:     parsed.htsCode,
        description: '',
        dutyRate:    'Unknown',
        chapter:     parsed.htsCode.substring(0, 2),
        found:       false,
      };
      return { success: true, data: notFound };
    }

    const found: GetDutyRatesOutput = {
      htsCode:     record.code,
      description: record.description,
      dutyRate:    record.duty_rate ?? 'Unknown',
      unit:        record.unit ?? undefined,
      chapter:     record.chapter,
      found:       true,
    };
    return { success: true, data: found };
  }

  // ---- Shared parse/validate helper ----
  private parseAndValidate<T>(
    response: Message,
    schema: {
      safeParse: (
        v: unknown,
      ) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } };
    },
    model: string,
  ): ToolCallResult {
    const first    = response.content[0];
    const text     = first?.type === 'text' ? first.text : '';
    const jsonText = text
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return { success: false, data: { error: 'Model returned non-JSON response', raw: text } };
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      return {
        success: false,
        data: { error: 'Output schema mismatch', issues: result.error.flatten() },
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
