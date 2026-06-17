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

// ================================================================
// bolType parameter — backward compatibility
// ================================================================

describe('backward compatibility — bolType defaults to TRUCK_BOL', () => {
  let server: BolProcessorMCP;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new BolProcessorMCP();
  });

  it('extract_bol_fields works without bolType (defaults to TRUCK_BOL)', async () => {
    const mockOutput = { bolNumber: 'BOL-001', extractionConfidence: 0.9 };
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(mockOutput));

    const result = await server.executeTool(
      'extract_bol_fields',
      { rawText: 'BOL NUMBER: BOL-001\nSHIPPER: Test Co\nDESTINATION: CNSHA' },
      makeCtx(),
    );

    expect(result.success).toBe(true);
  });

  it('validate_bol_data works without bolType — returns complianceFlags array', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ isValid: true, errors: [], missingRequiredFields: [] }),
    );

    const result = await server.executeTool(
      'validate_bol_data',
      {
        bolFields: {
          scacCode:  'MAEU',
          consignee: { name: 'Consignee LLC', address: '200 Oak Ave, Dallas TX' },
          bolNumber: 'BOL-001',
          extractionConfidence: 0.9,
        },
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as { complianceFlags: unknown[] };
    expect(Array.isArray(data.complianceFlags)).toBe(true);
    expect(data.complianceFlags).toHaveLength(0);
  });

  it('flag_bol_discrepancies works without bolType', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({
        hasDiscrepancies:  false,
        discrepancies:     [],
        recommendedAction: 'APPROVE',
        summary:           'Match.',
      }),
    );

    const result = await server.executeTool(
      'flag_bol_discrepancies',
      {
        bolFields:     { bolNumber: 'BOL-001', extractionConfidence: 0.9 },
        referenceDoc:  { poNumber: 'PO-001' },
        referenceType: 'PURCHASE_ORDER',
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
  });
});

// ================================================================
// AWB mode — extract_bol_fields
// ================================================================

describe('extract_bol_fields — AIR_WAYBILL mode', () => {
  let server: BolProcessorMCP;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new BolProcessorMCP();
  });

  const VALID_AWB_OUTPUT = {
    awbNumber:            '020-12345678',
    airlineCode:          'LH',
    originAirport:        'FRA',
    destinationAirport:   'JFK',
    pieces:               2,
    grossWeightKg:        100,
    chargeableWeightKg:   100,
    commodity:            'Electronics',
    freightCharges:       'prepaid',
    extractionConfidence: 0.95,
  };

  it('parses a valid AWB with all required fields', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(VALID_AWB_OUTPUT));

    const result = await server.executeTool(
      'extract_bol_fields',
      {
        rawText: 'AWB: 020-12345678\nAIRLINE: LH\nFROM: FRA\nTO: JFK\nPIECES: 2\nWEIGHT: 100kg',
        bolType: 'AIR_WAYBILL',
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as typeof VALID_AWB_OUTPUT;
    expect(data.awbNumber).toBe('020-12345678');
    expect(data.originAirport).toBe('FRA');
  });

  it('includes AWB-specific field names in the LLM prompt', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(VALID_AWB_OUTPUT));

    await server.executeTool(
      'extract_bol_fields',
      {
        rawText: 'AWB: 020-12345678\nAIRLINE: LH\nFROM: FRA\nTO: JFK\nPIECES: 2\nWEIGHT: 100kg',
        bolType: 'AIR_WAYBILL',
      },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { messages: { content: string }[] } | undefined;
    expect(callArg?.messages[0]?.content).toContain('awbNumber');
    expect(callArg?.messages[0]?.content).toContain('originAirport');
  });

  it('returns success:false when AWB output fails schema validation', async () => {
    // Missing required AWB fields (awbNumber, airlineCode, etc.)
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse({ extractionConfidence: 0.5 }));

    const result = await server.executeTool(
      'extract_bol_fields',
      {
        rawText: 'Cannot parse this document at all here we go',
        bolType: 'AIR_WAYBILL',
      },
      makeCtx(),
    );

    expect(result.success).toBe(false);
    expect((result.data as { error: string }).error).toBe('Output schema mismatch');
  });
});

// ================================================================
// Ocean BOL mode — extract_bol_fields
// ================================================================

describe('extract_bol_fields — OCEAN_BOL mode', () => {
  let server: BolProcessorMCP;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new BolProcessorMCP();
  });

  const VALID_OBOL_OUTPUT = {
    bolNumber:            'MBL-2024-001',
    vesselName:           'EVER GIVEN',
    voyageNumber:         'V001W',
    portOfLoading:        'CNSHA',
    portOfDischarge:      'USLAX',
    containers:           [{ containerNumber: 'CSCU1234567', type: '20GP', weightKg: 10_000 }],
    commodity:            'General Cargo',
    grossWeightKg:        10_000,
    freightTerms:         'prepaid',
    extractionConfidence: 0.92,
  };

  it('parses a valid Ocean BOL with all required fields', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(VALID_OBOL_OUTPUT));

    const result = await server.executeTool(
      'extract_bol_fields',
      {
        rawText: 'BOL: MBL-2024-001\nVESSEL: EVER GIVEN\nVOYAGE: V001W\nFROM: CNSHA\nTO: USLAX',
        bolType: 'OCEAN_BOL',
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as typeof VALID_OBOL_OUTPUT;
    expect(data.bolNumber).toBe('MBL-2024-001');
    expect(data.portOfLoading).toBe('CNSHA');
  });

  it('includes Ocean-specific field names in the LLM prompt', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse(VALID_OBOL_OUTPUT));

    await server.executeTool(
      'extract_bol_fields',
      {
        rawText: 'BOL: MBL-2024-001\nVESSEL: EVER GIVEN\nVOYAGE: V001W\nFROM: CNSHA\nTO: USLAX',
        bolType: 'OCEAN_BOL',
      },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { messages: { content: string }[] } | undefined;
    expect(callArg?.messages[0]?.content).toContain('portOfLoading');
    expect(callArg?.messages[0]?.content).toContain('containerNumber');
  });
});

// ================================================================
// validate_bol_data — AWB compliance flags via MCP tool
// ================================================================

describe('validate_bol_data — AWB compliance flag integration', () => {
  let server: BolProcessorMCP;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new BolProcessorMCP();
  });

  it('appends INVALID_AIRPORT_CODE flag when airport code is wrong', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ isValid: true, errors: [], missingRequiredFields: [] }),
    );

    const result = await server.executeTool(
      'validate_bol_data',
      {
        bolType: 'AIR_WAYBILL',
        bolFields: {
          awbNumber:          '020-12345678',
          airlineCode:        'LH',
          originAirport:      'FRANKFURT', // invalid — must be 3 chars
          destinationAirport: 'JFK',
          pieces:             1,
          grossWeightKg:      100,
          chargeableWeightKg: 100,
          commodity:          'Electronics',
        },
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as { complianceFlags: Array<{ code: string }> };
    expect(data.complianceFlags.some((f) => f.code === 'INVALID_AIRPORT_CODE')).toBe(true);
  });

  it('appends DANGEROUS_GOODS_UNDECLARED flag for lithium battery without DGR', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ isValid: true, errors: [], missingRequiredFields: [] }),
    );

    const result = await server.executeTool(
      'validate_bol_data',
      {
        bolType: 'AIR_WAYBILL',
        bolFields: {
          awbNumber:          '020-12345678',
          airlineCode:        'LH',
          originAirport:      'FRA',
          destinationAirport: 'JFK',
          pieces:             1,
          grossWeightKg:      50,
          chargeableWeightKg: 50,
          commodity:          'Lithium battery packs for EVs',
          specialHandling:    [],
        },
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as { complianceFlags: Array<{ code: string; severity: string }> };
    const dgrFlag = data.complianceFlags.find((f) => f.code === 'DANGEROUS_GOODS_UNDECLARED');
    expect(dgrFlag).toBeDefined();
    expect(dgrFlag?.severity).toBe('critical');
  });
});

// ================================================================
// validate_bol_data — Ocean BOL compliance flags
// ================================================================

describe('validate_bol_data — Ocean BOL compliance flags', () => {
  let server: BolProcessorMCP;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new BolProcessorMCP();
  });

  const OCEAN_BOL_BASE = {
    portOfLoading:   'CNSHA',
    portOfDischarge: 'USLAX',
    containers: [{ containerNumber: 'CSCU1234567' }],
  };

  it('appends MISSING_CONTAINER_NUMBERS flag when containers is empty', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ isValid: false, errors: [], missingRequiredFields: [] }),
    );

    const result = await server.executeTool(
      'validate_bol_data',
      { bolType: 'OCEAN_BOL', bolFields: { ...OCEAN_BOL_BASE, containers: [] } },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as { complianceFlags: Array<{ code: string }> };
    expect(data.complianceFlags.some((f) => f.code === 'MISSING_CONTAINER_NUMBERS')).toBe(true);
  });

  it('appends HBL_WITHOUT_MBL flag when HBL has no MBL', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ isValid: true, errors: [], missingRequiredFields: [] }),
    );

    const result = await server.executeTool(
      'validate_bol_data',
      { bolType: 'OCEAN_BOL', bolFields: { ...OCEAN_BOL_BASE, hblNumber: 'HBL-001' } },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as { complianceFlags: Array<{ code: string }> };
    expect(data.complianceFlags.some((f) => f.code === 'HBL_WITHOUT_MBL')).toBe(true);
  });

  it('appends CONTAINER_FORMAT_INVALID flag for badly-formatted container number', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ isValid: true, errors: [], missingRequiredFields: [] }),
    );

    const result = await server.executeTool(
      'validate_bol_data',
      {
        bolType:   'OCEAN_BOL',
        bolFields: { ...OCEAN_BOL_BASE, containers: [{ containerNumber: 'BADNUM-001' }] },
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as { complianceFlags: Array<{ code: string }> };
    expect(data.complianceFlags.some((f) => f.code === 'CONTAINER_FORMAT_INVALID')).toBe(true);
  });

  it('appends MISSING_PORT_CODES flag for invalid portOfLoading LOCODE', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ isValid: false, errors: [], missingRequiredFields: [] }),
    );

    const result = await server.executeTool(
      'validate_bol_data',
      { bolType: 'OCEAN_BOL', bolFields: { ...OCEAN_BOL_BASE, portOfLoading: '' } },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as { complianceFlags: Array<{ code: string }> };
    expect(data.complianceFlags.some((f) => f.code === 'MISSING_PORT_CODES')).toBe(true);
  });
});

// ================================================================
// GUARDRAIL INTEGRATION — CUSTOMS_BROKER_UNVERIFIED end-to-end
// ================================================================
// Verifies that an Ocean BOL with customsBroker.verified=false produces
// a CUSTOMS_BROKER_UNVERIFIED critical compliance flag through the full
// validate_bol_data execution path.

describe('guardrail integration — CUSTOMS_BROKER_UNVERIFIED', () => {
  let server: BolProcessorMCP;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new BolProcessorMCP();
  });

  it('Ocean BOL with unverified broker returns CUSTOMS_BROKER_UNVERIFIED critical flag', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ isValid: true, errors: [], missingRequiredFields: [] }),
    );

    const result = await server.executeTool(
      'validate_bol_data',
      {
        bolType: 'OCEAN_BOL',
        bolFields: {
          portOfLoading:   'CNSHA',
          portOfDischarge: 'USLAX',
          containers: [{ containerNumber: 'CSCU1234567' }],
          customsBroker: { name: 'FastBroker LLC', verified: false },
        },
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as {
      isValid: boolean;
      complianceFlags: Array<{ code: string; severity: string; message: string }>;
    };

    const customsFlag = data.complianceFlags.find(
      (f) => f.code === 'CUSTOMS_BROKER_UNVERIFIED',
    );
    expect(customsFlag).toBeDefined();
    expect(customsFlag?.severity).toBe('critical');
    expect(customsFlag?.message).toContain('not been verified');
  });

  it('Ocean BOL with verified broker produces no CUSTOMS_BROKER_UNVERIFIED flag', async () => {
    MOCK_CREATE.mockResolvedValue(
      makeAnthropicResponse({ isValid: true, errors: [], missingRequiredFields: [] }),
    );

    const result = await server.executeTool(
      'validate_bol_data',
      {
        bolType: 'OCEAN_BOL',
        bolFields: {
          portOfLoading:   'CNSHA',
          portOfDischarge: 'USLAX',
          containers: [{ containerNumber: 'CSCU1234567' }],
          customsBroker: { name: 'TrustedBroker Inc', verified: true },
        },
      },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as { complianceFlags: Array<{ code: string }> };
    expect(data.complianceFlags.some((f) => f.code === 'CUSTOMS_BROKER_UNVERIFIED')).toBe(false);
  });
});
