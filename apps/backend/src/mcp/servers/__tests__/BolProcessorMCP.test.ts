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

// Mock the guardrail engine singleton (same pattern as BaseMCPServer.test.ts)
vi.mock('../../../guardrails/GuardrailEngine.js', () => ({
  guardrailEngine: { enforce: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../guardrails/rules/InputSchemaRule.js', () => ({
  InputSchemaRule:    class InputSchemaRule { check = vi.fn().mockResolvedValue(null) },
  registerToolSchema: vi.fn(),
}));

import Anthropic from '@anthropic-ai/sdk';

import type { ToolCallContext } from '../../types.js';
import { BolProcessorMCP } from '../BolProcessorMCP.js';

// ---- Helpers ----

function makeCtx(overrides: Partial<ToolCallContext> = {}): ToolCallContext {
  return {
    tenantId:  'tenant-test',
    userId:    'user-test',
    tier:      TenantTier.GROWTH,
    mcpServer: 'bol-processor',
    requestId: 'req-test',
    ...overrides,
  };
}

function makeAnthropicResponse(jsonContent: unknown) {
  return {
    content: [{ type: 'text', text: JSON.stringify(jsonContent) }],
    usage:   { input_tokens: 100, output_tokens: 50 },
  };
}

// BolProcessorMCP.ts calls `new Anthropic()` at MODULE level (outside any constructor).
// That fires exactly once — when the module is first imported above. We capture the
// reference to messages.create here, at module-eval time, before any beforeEach can
// call vi.clearAllMocks() and wipe Anthropic.mock.results[].
const _anthropicInst = (
  Anthropic as unknown as ReturnType<typeof vi.fn>
).mock.results[0]?.value as { messages: { create: ReturnType<typeof vi.fn> } } | undefined;

// Fallback to a bare vi.fn() if capture somehow misses (should never happen).
const MOCK_CREATE: ReturnType<typeof vi.fn> = _anthropicInst?.messages.create ?? vi.fn();

// ---- Tests ----

describe('BolProcessorMCP — server metadata', () => {
  let server: BolProcessorMCP;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new BolProcessorMCP();
  });

  it('has correct name and version', () => {
    expect(server.name).toBe('bol-processor');
    expect(server.version).toBe('1.0.0');
  });

  it('exposes exactly 3 tools', () => {
    expect(server.tools).toHaveLength(3);
  });

  it('tool names match spec', () => {
    const names = server.tools.map((t) => t.name);
    expect(names).toContain('extract_bol_fields');
    expect(names).toContain('validate_bol_data');
    expect(names).toContain('flag_bol_discrepancies');
  });

  it('each tool has a description and inputSchema', () => {
    for (const tool of server.tools) {
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it('throws GuardrailViolationError path — assertToolExists for unknown tool', async () => {
    await expect(
      server.executeTool('nonexistent', {}, makeCtx()),
    ).rejects.toThrow("Tool 'nonexistent' not found");
  });
});

// ---- extract_bol_fields ----

describe('extract_bol_fields', () => {
  let server: BolProcessorMCP;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new BolProcessorMCP();
  });

  it('returns structured fields from valid BOL text', async () => {
    const mockOutput = {
      bolNumber:            'BOL-2024-001',
      shipperName:          'Acme Corp',
      consigneeName:        'Beta Ltd',
      originPort:           'USLAX',
      destinationPort:      'CNSHA',
      carrierName:          'Maersk',
      extractionConfidence: 0.92,
    };
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(mockOutput));

    const result = await server.executeTool(
      'extract_bol_fields',
      {
        rawText:
          'BOL NUMBER: BOL-2024-001\nSHIPPER: Acme Corp\nCONSIGNEE: Beta Ltd\n' +
          'ORIGIN: USLAX\nDEST: CNSHA\nCARRIER: Maersk',
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as typeof mockOutput;
    expect(data.bolNumber).toBe('BOL-2024-001');
    expect(data.extractionConfidence).toBe(0.92);
    expect(result.meta?.model).toBe('claude-sonnet-4-6');
    expect(result.meta?.tokensUsed).toBe(150);
  });

  it('passes the optional carrierHint to the prompt', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ extractionConfidence: 0.8 }),
    );

    await server.executeTool(
      'extract_bol_fields',
      { rawText: 'some bol text here and more text', carrierHint: 'Hapag-Lloyd' },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { messages: { content: string }[] } | undefined;
    expect(callArg?.messages[0]?.content).toContain('Hapag-Lloyd');
  });

  it('strips markdown code fences before parsing', async () => {
    const innerJson = { bolNumber: 'BOL-999', extractionConfidence: 0.7 };
    MOCK_CREATE.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n' + JSON.stringify(innerJson) + '\n```' }],
      usage: { input_tokens: 10, output_tokens: 20 },
    });

    const result = await server.executeTool(
      'extract_bol_fields',
      { rawText: 'BOL text content here with enough chars' },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    expect((result.data as { bolNumber: string }).bolNumber).toBe('BOL-999');
  });

  it('returns success:false when model returns non-JSON', async () => {
    MOCK_CREATE.mockResolvedValue({
      content: [{ type: 'text', text: 'Sorry, I cannot process this document.' }],
      usage:   { input_tokens: 10, output_tokens: 5 },
    });

    const result = await server.executeTool(
      'extract_bol_fields',
      { rawText: 'some bol text here and more text' },
      makeCtx(),
    );

    expect(result.success).toBe(false);
    expect((result.data as { error: string }).error).toBe('Model returned non-JSON response');
  });

  it('returns success:false on output schema mismatch', async () => {
    // extractionConfidence is required and must be 0-1; value 5 is invalid
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse({ extractionConfidence: 5 }));

    const result = await server.executeTool(
      'extract_bol_fields',
      { rawText: 'some bol text here and more text' },
      makeCtx(),
    );

    expect(result.success).toBe(false);
    expect((result.data as { error: string }).error).toBe('Output schema mismatch');
  });

  it('rejects rawText shorter than 10 chars (Zod validation)', async () => {
    await expect(
      server.executeTool('extract_bol_fields', { rawText: 'short' }, makeCtx()),
    ).rejects.toThrow();
  });

  it('uses claude-sonnet-4-6 model (locked routing)', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse({ extractionConfidence: 0.9 }));

    await server.executeTool(
      'extract_bol_fields',
      { rawText: 'some bol text here with content' },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { model: string } | undefined;
    expect(callArg?.model).toBe('claude-sonnet-4-6');
  });
});

// ---- validate_bol_data ----

describe('validate_bol_data', () => {
  let server: BolProcessorMCP;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new BolProcessorMCP();
  });

  const FULL_BOL_FIELDS = {
    bolNumber:            'BOL-001',
    shipperName:          'Acme',
    consigneeName:        'Beta',
    originPort:           'USLAX',
    destinationPort:      'CNSHA',
    carrierName:          'Maersk',
    extractionConfidence: 0.95,
  };

  it('returns isValid:true for complete BOL data', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ isValid: true, errors: [], missingRequiredFields: [] }),
    );

    const result = await server.executeTool(
      'validate_bol_data',
      { bolFields: FULL_BOL_FIELDS },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    expect((result.data as { isValid: boolean }).isValid).toBe(true);
    expect(result.meta?.model).toBe('claude-haiku-4-5-20251001');
  });

  it('returns isValid:false and errors for missing required fields', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({
        isValid: false,
        errors: [{ field: 'bolNumber', message: 'Required field missing', severity: 'error' }],
        missingRequiredFields: ['bolNumber'],
      }),
    );

    const result = await server.executeTool(
      'validate_bol_data',
      { bolFields: { extractionConfidence: 0.5 } },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as { isValid: boolean; missingRequiredFields: string[] };
    expect(data.isValid).toBe(false);
    expect(data.missingRequiredFields).toContain('bolNumber');
  });

  it('defaults strictness to "standard"', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ isValid: true, errors: [], missingRequiredFields: [] }),
    );

    await server.executeTool(
      'validate_bol_data',
      { bolFields: FULL_BOL_FIELDS }, // no strictness field
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { messages: { content: string }[] } | undefined;
    expect(callArg?.messages[0]?.content).toContain('standard');
  });

  it('forwards explicit strictness to the prompt', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ isValid: true, errors: [], missingRequiredFields: [] }),
    );

    await server.executeTool(
      'validate_bol_data',
      { bolFields: FULL_BOL_FIELDS, strictness: 'strict' },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { messages: { content: string }[] } | undefined;
    expect(callArg?.messages[0]?.content).toContain('strict');
  });

  it('uses claude-haiku-4-5-20251001 model (locked routing)', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ isValid: true, errors: [], missingRequiredFields: [] }),
    );

    await server.executeTool(
      'validate_bol_data',
      { bolFields: FULL_BOL_FIELDS },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { model: string } | undefined;
    expect(callArg?.model).toBe('claude-haiku-4-5-20251001');
  });

  it('returns success:false when model returns non-JSON', async () => {
    MOCK_CREATE.mockResolvedValue({
      content: [{ type: 'text', text: 'Cannot validate.' }],
      usage:   { input_tokens: 5, output_tokens: 3 },
    });

    const result = await server.executeTool(
      'validate_bol_data',
      { bolFields: { extractionConfidence: 0.5 } },
      makeCtx(),
    );

    expect(result.success).toBe(false);
  });
});

// ---- flag_bol_discrepancies ----

describe('flag_bol_discrepancies', () => {
  let server: BolProcessorMCP;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new BolProcessorMCP();
  });

  it('returns APPROVE when no discrepancies found', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({
        hasDiscrepancies:  false,
        discrepancies:     [],
        recommendedAction: 'APPROVE',
        summary:           'BOL matches PO exactly.',
      }),
    );

    const result = await server.executeTool(
      'flag_bol_discrepancies',
      {
        bolFields:     { bolNumber: 'BOL-001', extractionConfidence: 0.99 },
        referenceDoc:  { poNumber: 'PO-001', destination: 'CNSHA' },
        referenceType: 'PURCHASE_ORDER',
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as { hasDiscrepancies: boolean; recommendedAction: string };
    expect(data.hasDiscrepancies).toBe(false);
    expect(data.recommendedAction).toBe('APPROVE');
    expect(result.meta?.model).toBe('claude-opus-4-6');
  });

  it('flags critical discrepancy for wrong destination', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({
        hasDiscrepancies: true,
        discrepancies: [
          {
            field:          'destinationPort',
            bolValue:       'JPOSA',
            referenceValue: 'CNSHA',
            severity:       'critical',
            explanation:    'Destination port does not match PO.',
          },
        ],
        recommendedAction: 'REJECT',
        summary:           'Critical destination mismatch detected.',
      }),
    );

    const result = await server.executeTool(
      'flag_bol_discrepancies',
      {
        bolFields:     { destinationPort: 'JPOSA', extractionConfidence: 0.95 },
        referenceDoc:  { destination: 'CNSHA' },
        referenceType: 'PURCHASE_ORDER',
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as {
      hasDiscrepancies: boolean;
      recommendedAction: string;
      discrepancies: { severity: string }[];
    };
    expect(data.hasDiscrepancies).toBe(true);
    expect(data.recommendedAction).toBe('REJECT');
    expect(data.discrepancies[0]?.severity).toBe('critical');
  });

  it('includes referenceType in the prompt', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({
        hasDiscrepancies:  false,
        discrepancies:     [],
        recommendedAction: 'APPROVE',
        summary:           'Match.',
      }),
    );

    await server.executeTool(
      'flag_bol_discrepancies',
      {
        bolFields:     { extractionConfidence: 0.9 },
        referenceDoc:  { invoiceId: 'INV-001' },
        referenceType: 'INVOICE',
      },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { messages: { content: string }[] } | undefined;
    expect(callArg?.messages[0]?.content).toContain('INVOICE');
  });

  it('uses claude-opus-4-6 model (locked routing)', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({
        hasDiscrepancies:  false,
        discrepancies:     [],
        recommendedAction: 'APPROVE',
        summary:           'OK.',
      }),
    );

    await server.executeTool(
      'flag_bol_discrepancies',
      {
        bolFields:     { extractionConfidence: 0.9 },
        referenceDoc:  { poNumber: 'PO-002' },
        referenceType: 'SHIPMENT_RECORD',
      },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { model: string } | undefined;
    expect(callArg?.model).toBe('claude-opus-4-6');
  });

  it('returns success:false when model returns non-JSON', async () => {
    MOCK_CREATE.mockResolvedValue({
      content: [{ type: 'text', text: 'Unable to compare.' }],
      usage:   { input_tokens: 5, output_tokens: 3 },
    });

    const result = await server.executeTool(
      'flag_bol_discrepancies',
      {
        bolFields:     { extractionConfidence: 0.5 },
        referenceDoc:  { poNumber: 'PO-003' },
        referenceType: 'PURCHASE_ORDER',
      },
      makeCtx(),
    );

    expect(result.success).toBe(false);
  });
});
