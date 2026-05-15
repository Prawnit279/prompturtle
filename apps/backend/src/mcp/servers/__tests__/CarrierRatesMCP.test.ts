import { TenantTier } from '@prompturtle/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks (before imports that use them) ----

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock('../../../lib/cost-tracker.js', () => ({
  trackedCall: vi.fn().mockImplementation((_opts: unknown, fn: () => unknown) => fn()),
}));

vi.mock('../../../lib/logger.js', () => ({
  default: {
    info:  vi.fn(),
    error: vi.fn(),
    warn:  vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

// Mock guardrail engine (prevents loading InputSchemaRule class chain)
vi.mock('../../../guardrails/GuardrailEngine.js', () => ({
  guardrailEngine: { enforce: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../guardrails/rules/InputSchemaRule.js', () => ({
  InputSchemaRule:    class InputSchemaRule { check = vi.fn().mockResolvedValue(null) },
  registerToolSchema: vi.fn(),
}));

import Anthropic from '@anthropic-ai/sdk';

import type { ToolCallContext } from '../../types.js';
import { CarrierRatesMCP } from '../CarrierRatesMCP.js';

// ---- Helpers ----

function makeCtx(overrides: Partial<ToolCallContext> = {}): ToolCallContext {
  return {
    tenantId:  'tenant-test',
    userId:    'user-test',
    tier:      TenantTier.GROWTH,
    mcpServer: 'carrier-rates',
    requestId: 'req-test',
    ...overrides,
  };
}

function makeAnthropicResponse(jsonContent: unknown) {
  return {
    content: [{ type: 'text', text: JSON.stringify(jsonContent) }],
    usage:   { input_tokens: 80, output_tokens: 40 },
  };
}

// CarrierRatesMCP.ts calls `new Anthropic()` at MODULE level (on import).
// Capture the messages.create reference now — before any beforeEach wipes mock.results.
const _anthropicInst = (
  Anthropic as unknown as ReturnType<typeof vi.fn>
).mock.results[0]?.value as { messages: { create: ReturnType<typeof vi.fn> } } | undefined;

const MOCK_CREATE: ReturnType<typeof vi.fn> = _anthropicInst?.messages.create ?? vi.fn();

// ---- Shared test fixtures ----

const SAMPLE_QUOTES = [
  {
    carrierId:    'maersk',
    carrierName:  'Maersk',
    serviceLevel: 'STANDARD' as const,
    totalCostUsd: 1200,
    transitDays:  21,
    currency:     'USD',
  },
  {
    carrierId:    'fedex',
    carrierName:  'FedEx',
    serviceLevel: 'EXPRESS' as const,
    totalCostUsd: 3400,
    transitDays:  5,
    currency:     'USD',
  },
];

// ---- Tests ----

describe('CarrierRatesMCP — server metadata', () => {
  let server: CarrierRatesMCP;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new CarrierRatesMCP();
  });

  it('has correct name and version', () => {
    expect(server.name).toBe('carrier-rates');
    expect(server.version).toBe('1.0.0');
  });

  it('exposes exactly 3 tools', () => {
    expect(server.tools).toHaveLength(3);
  });

  it('tool names match spec', () => {
    const names = server.tools.map((t) => t.name);
    expect(names).toContain('get_carrier_rates');
    expect(names).toContain('compare_carrier_options');
    expect(names).toContain('recommend_carrier');
  });

  it('each tool has a description and inputSchema', () => {
    for (const tool of server.tools) {
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it('throws for unknown tool', async () => {
    await expect(
      server.executeTool('ghost', {}, makeCtx()),
    ).rejects.toThrow("Tool 'ghost' not found");
  });
});

// ---- get_carrier_rates ----

describe('get_carrier_rates', () => {
  let server: CarrierRatesMCP;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new CarrierRatesMCP();
  });

  const VALID_RATES_RESPONSE = {
    quotes:            SAMPLE_QUOTES,
    currency:          'USD',
    quotedAt:          new Date().toISOString(),
    cheapestCarrierId: 'maersk',
    fastestCarrierId:  'fedex',
  };

  it('returns structured quotes for a valid shipment', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(VALID_RATES_RESPONSE));

    const result = await server.executeTool(
      'get_carrier_rates',
      { originCountry: 'US', destinationCountry: 'CN', weightKg: 500 },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as typeof VALID_RATES_RESPONSE;
    expect(data.quotes).toHaveLength(2);
    expect(data.cheapestCarrierId).toBe('maersk');
    expect(data.fastestCarrierId).toBe('fedex');
  });

  it('includes optional fields in the prompt when provided', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(VALID_RATES_RESPONSE));

    await server.executeTool(
      'get_carrier_rates',
      {
        originCountry:        'US',
        destinationCountry:   'DE',
        originCity:           'New York',
        destinationCity:      'Hamburg',
        weightKg:             120,
        commodityDescription: 'Industrial machinery',
        incoterms:            'FOB',
        carriers:             ['maersk', 'hapag'],
      },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { messages: { content: string }[] } | undefined;
    const content = callArg?.messages[0]?.content ?? '';
    expect(content).toContain('New York');
    expect(content).toContain('FOB');
    expect(content).toContain('maersk');
  });

  it('strips markdown code fences before JSON parsing', async () => {
    MOCK_CREATE.mockResolvedValue({
      content: [{
        type: 'text',
        text: '```json\n' + JSON.stringify(VALID_RATES_RESPONSE) + '\n```',
      }],
      usage: { input_tokens: 10, output_tokens: 20 },
    });

    const result = await server.executeTool(
      'get_carrier_rates',
      { originCountry: 'US', destinationCountry: 'CN', weightKg: 100 },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    expect((result.data as typeof VALID_RATES_RESPONSE).currency).toBe('USD');
  });

  it('returns success:false when model returns non-JSON', async () => {
    MOCK_CREATE.mockResolvedValue({
      content: [{ type: 'text', text: 'I cannot provide rates for this route.' }],
      usage:   { input_tokens: 10, output_tokens: 5 },
    });

    const result = await server.executeTool(
      'get_carrier_rates',
      { originCountry: 'US', destinationCountry: 'CN', weightKg: 100 },
      makeCtx(),
    );

    expect(result.success).toBe(false);
    expect((result.data as { error: string }).error).toBe('Model returned non-JSON response');
  });

  it('returns success:false on output schema mismatch', async () => {
    // quotes is required in output — omitting it causes schema failure
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ currency: 'USD', quotedAt: new Date().toISOString() }),
    );

    const result = await server.executeTool(
      'get_carrier_rates',
      { originCountry: 'US', destinationCountry: 'CN', weightKg: 100 },
      makeCtx(),
    );

    expect(result.success).toBe(false);
    expect((result.data as { error: string }).error).toBe('Output schema mismatch');
  });

  it('rejects invalid country code (not exactly 2 chars)', async () => {
    await expect(
      server.executeTool(
        'get_carrier_rates',
        { originCountry: 'USA', destinationCountry: 'CN', weightKg: 100 },
        makeCtx(),
      ),
    ).rejects.toThrow();
  });

  it('uses claude-haiku-4-5-20251001 (locked routing)', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(VALID_RATES_RESPONSE));

    await server.executeTool(
      'get_carrier_rates',
      { originCountry: 'US', destinationCountry: 'CN', weightKg: 100 },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { model: string } | undefined;
    expect(callArg?.model).toBe('claude-haiku-4-5-20251001');
  });

  it('reports tokensUsed in meta', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(VALID_RATES_RESPONSE));

    const result = await server.executeTool(
      'get_carrier_rates',
      { originCountry: 'US', destinationCountry: 'CN', weightKg: 100 },
      makeCtx(),
    );

    expect(result.meta?.tokensUsed).toBe(120); // 80 + 40
  });
});

// ---- compare_carrier_options ----

describe('compare_carrier_options', () => {
  let server: CarrierRatesMCP;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new CarrierRatesMCP();
  });

  const COMPARISON_RESPONSE = {
    comparison: [
      {
        carrierId:    'maersk',
        carrierName:  'Maersk',
        costScore:    9,
        speedScore:   3,
        overallScore: 6,
        pros:         ['Cheap', 'Reliable'],
        cons:         ['Slow transit'],
      },
      {
        carrierId:    'fedex',
        carrierName:  'FedEx',
        costScore:    2,
        speedScore:   10,
        overallScore: 6,
        pros:         ['Fast'],
        cons:         ['Expensive'],
      },
    ],
    summary: 'Maersk is cheaper; FedEx is faster.',
  };

  it('returns scored comparison for 2+ quotes', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(COMPARISON_RESPONSE));

    const result = await server.executeTool(
      'compare_carrier_options',
      {
        quotes:          SAMPLE_QUOTES,
        shipmentContext: { weightKg: 500, destinationCountry: 'CN' },
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as typeof COMPARISON_RESPONSE;
    expect(data.comparison).toHaveLength(2);
    expect(data.comparison[0]?.carrierId).toBe('maersk');
    expect(data.summary).toBe('Maersk is cheaper; FedEx is faster.');
    expect(result.meta?.model).toBe('claude-sonnet-4-6');
  });

  it('includes shipment context in the prompt', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(COMPARISON_RESPONSE));

    await server.executeTool(
      'compare_carrier_options',
      {
        quotes:          SAMPLE_QUOTES,
        shipmentContext: {
          weightKg:             500,
          destinationCountry:   'DE',
          commodityDescription: 'Electronics',
        },
      },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { messages: { content: string }[] } | undefined;
    expect(callArg?.messages[0]?.content).toContain('Electronics');
  });

  it('rejects fewer than 2 quotes (Zod min(2))', async () => {
    await expect(
      server.executeTool(
        'compare_carrier_options',
        {
          quotes:          [SAMPLE_QUOTES[0]],
          shipmentContext: { weightKg: 100, destinationCountry: 'CN' },
        },
        makeCtx(),
      ),
    ).rejects.toThrow();
  });

  it('uses claude-sonnet-4-6 (locked routing)', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(COMPARISON_RESPONSE));

    await server.executeTool(
      'compare_carrier_options',
      {
        quotes:          SAMPLE_QUOTES,
        shipmentContext: { weightKg: 500, destinationCountry: 'CN' },
      },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { model: string } | undefined;
    expect(callArg?.model).toBe('claude-sonnet-4-6');
  });

  it('returns success:false when model returns non-JSON', async () => {
    MOCK_CREATE.mockResolvedValue({
      content: [{ type: 'text', text: 'Unable to compare carriers.' }],
      usage:   { input_tokens: 5, output_tokens: 3 },
    });

    const result = await server.executeTool(
      'compare_carrier_options',
      {
        quotes:          SAMPLE_QUOTES,
        shipmentContext: { weightKg: 500, destinationCountry: 'CN' },
      },
      makeCtx(),
    );

    expect(result.success).toBe(false);
  });
});

// ---- recommend_carrier ----

describe('recommend_carrier', () => {
  let server: CarrierRatesMCP;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new CarrierRatesMCP();
  });

  const RECOMMEND_RESPONSE = {
    recommendedCarrierId:   'maersk',
    recommendedCarrierName: 'Maersk',
    confidence:             0.87,
    rationale:              'Maersk offers the best cost-to-transit ratio given cost-heavy priorities.',
    alternatives: [
      { carrierId: 'fedex', carrierName: 'FedEx', reason: 'Faster but 2.8× more expensive.' },
    ],
  };

  it('returns recommendation with rationale and alternatives', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(RECOMMEND_RESPONSE));

    const result = await server.executeTool(
      'recommend_carrier',
      {
        quotes:      SAMPLE_QUOTES,
        priorities:  { costWeight: 0.7, speedWeight: 0.3 },
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as typeof RECOMMEND_RESPONSE;
    expect(data.recommendedCarrierId).toBe('maersk');
    expect(data.confidence).toBe(0.87);
    expect(data.alternatives).toHaveLength(1);
    expect(result.meta?.model).toBe('claude-sonnet-4-6');
  });

  it('forwards business context and constraints to the prompt', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(RECOMMEND_RESPONSE));

    await server.executeTool(
      'recommend_carrier',
      {
        quotes:          SAMPLE_QUOTES,
        priorities:      { costWeight: 0.5, speedWeight: 0.5 },
        constraints:     { maxBudgetUsd: 2000, excludedCarriers: ['dhl'] },
        businessContext: 'Customer requires delivery before Chinese New Year.',
      },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { messages: { content: string }[] } | undefined;
    const content = callArg?.messages[0]?.content ?? '';
    expect(content).toContain('Chinese New Year');
    expect(content).toContain('dhl');
  });

  it('rejects priorities that sum over 1.0 (Zod refine)', async () => {
    await expect(
      server.executeTool(
        'recommend_carrier',
        {
          quotes:     SAMPLE_QUOTES,
          priorities: { costWeight: 0.8, speedWeight: 0.8 },
        },
        makeCtx(),
      ),
    ).rejects.toThrow();
  });

  it('accepts priorities that sum to exactly 1.0', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(RECOMMEND_RESPONSE));

    const result = await server.executeTool(
      'recommend_carrier',
      {
        quotes:     SAMPLE_QUOTES,
        priorities: { costWeight: 0.5, speedWeight: 0.5 },
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
  });

  it('accepts priorities with reliabilityWeight that sum to ≤ 1.0', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(RECOMMEND_RESPONSE));

    const result = await server.executeTool(
      'recommend_carrier',
      {
        quotes:     SAMPLE_QUOTES,
        priorities: { costWeight: 0.4, speedWeight: 0.4, reliabilityWeight: 0.2 },
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
  });

  it('uses claude-sonnet-4-6 (locked routing)', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(RECOMMEND_RESPONSE));

    await server.executeTool(
      'recommend_carrier',
      {
        quotes:     SAMPLE_QUOTES,
        priorities: { costWeight: 0.5, speedWeight: 0.5 },
      },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { model: string } | undefined;
    expect(callArg?.model).toBe('claude-sonnet-4-6');
  });

  it('returns success:false when model returns non-JSON', async () => {
    MOCK_CREATE.mockResolvedValue({
      content: [{ type: 'text', text: 'Unable to recommend a carrier.' }],
      usage:   { input_tokens: 5, output_tokens: 3 },
    });

    const result = await server.executeTool(
      'recommend_carrier',
      {
        quotes:     SAMPLE_QUOTES,
        priorities: { costWeight: 0.5, speedWeight: 0.5 },
      },
      makeCtx(),
    );

    expect(result.success).toBe(false);
  });

  it('returns success:false on output schema mismatch', async () => {
    // confidence must be 0-1; value 99 is invalid
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({
        recommendedCarrierId:   'maersk',
        recommendedCarrierName: 'Maersk',
        confidence:             99,
        rationale:              'OK',
        alternatives:           [],
      }),
    );

    const result = await server.executeTool(
      'recommend_carrier',
      {
        quotes:     SAMPLE_QUOTES,
        priorities: { costWeight: 0.5, speedWeight: 0.5 },
      },
      makeCtx(),
    );

    expect(result.success).toBe(false);
    expect((result.data as { error: string }).error).toBe('Output schema mismatch');
  });
});
