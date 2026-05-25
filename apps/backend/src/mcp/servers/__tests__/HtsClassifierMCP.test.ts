import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HtsClassifierMCP } from '../HtsClassifierMCP.js';
import { TenantTier } from '@prompturtle/shared';
import type { ToolCallContext } from '../../types.js';

// ---- Mocks ----
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock('../../../lib/cost-tracker.js', () => ({
  trackedCall: vi.fn().mockImplementation((_o: unknown, fn: () => unknown) => fn()),
}));

vi.mock('../../../lib/logger.js', () => ({
  default: {
    info:  vi.fn(),
    error: vi.fn(),
    warn:  vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

vi.mock('../../../guardrails/GuardrailEngine.js', () => ({
  guardrailEngine: { enforce: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../guardrails/rules/InputSchemaRule.js', () => ({
  InputSchemaRule:    class InputSchemaRule { check = vi.fn().mockResolvedValue(null); },
  registerToolSchema: vi.fn(),
}));

vi.mock('../../../data/hts-ingest.js', () => ({
  searchHtsCodes: vi.fn().mockResolvedValue([
    {
      code:        '8471.30.01',
      description: 'Portable automatic data processing machines',
      chapter:     '84',
      dutyRate:    'Free',
      similarity:  0.94,
    },
    {
      code:        '8471.41.01',
      description: 'Other automatic data processing machines',
      chapter:     '84',
      dutyRate:    'Free',
      similarity:  0.88,
    },
  ]),
}));

vi.mock('../../../lib/db.js', () => ({
  prisma: {
    htsCode: {
      findUnique: vi.fn().mockResolvedValue({
        code:        '8471.30.01',
        description: 'Portable automatic data processing machines',
        chapter:     '84',
        duty_rate:   'Free',
        unit:        'No.',
      }),
    },
  },
}));

// ---- Module-level MOCK_CREATE capture ----
// Captured at module-eval time (before any beforeEach can call vi.clearAllMocks()
// and wipe Anthropic.mock.results[]).
import Anthropic from '@anthropic-ai/sdk';
import { searchHtsCodes } from '../../../data/hts-ingest.js';
import { prisma } from '../../../lib/db.js';
import { trackedCall } from '../../../lib/cost-tracker.js';

const _anthropicInst = (
  Anthropic as unknown as ReturnType<typeof vi.fn>
).mock.results[0]?.value as { messages: { create: ReturnType<typeof vi.fn> } } | undefined;

const MOCK_CREATE: ReturnType<typeof vi.fn> =
  _anthropicInst?.messages.create ?? vi.fn();

const mockSearchHts  = searchHtsCodes as ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindUnique = (prisma.htsCode as any).findUnique as ReturnType<typeof vi.fn>;
const mockTrackedCall = trackedCall as ReturnType<typeof vi.fn>;

// ---- Helpers ----
function makeCtx(overrides: Partial<ToolCallContext> = {}): ToolCallContext {
  return {
    tenantId:  'tenant-test',
    userId:    'user-test',
    tier:      TenantTier.GROWTH,
    mcpServer: 'hts-classifier',
    requestId: 'req-test',
    ...overrides,
  };
}

function makeAnthropicResponse(content: unknown) {
  return {
    content: [{ type: 'text', text: JSON.stringify(content) }],
    usage:   { input_tokens: 200, output_tokens: 100 },
  };
}

let server: HtsClassifierMCP;

beforeEach(() => {
  vi.clearAllMocks();
  server = new HtsClassifierMCP();
  // Re-wire MOCK_CREATE after clearAllMocks resets call tracking
  if (_anthropicInst) {
    _anthropicInst.messages.create = MOCK_CREATE;
  }
  // Reset default mock values
  mockSearchHts.mockResolvedValue([
    { code: '8471.30.01', description: 'Portable automatic data processing machines', chapter: '84', dutyRate: 'Free', similarity: 0.94 },
    { code: '8471.41.01', description: 'Other automatic data processing machines', chapter: '84', dutyRate: 'Free', similarity: 0.88 },
  ]);
  mockFindUnique.mockResolvedValue({
    code: '8471.30.01', description: 'Portable automatic data processing machines',
    chapter: '84', duty_rate: 'Free', unit: 'No.',
  });
  mockTrackedCall.mockImplementation((_o: unknown, fn: () => unknown) => fn());
});

// ===========================================================================
describe('HtsClassifierMCP — metadata', () => {
  it('has correct name and version', () => {
    expect(server.name).toBe('hts-classifier');
    expect(server.version).toBe('1.0.0');
  });

  it('exposes exactly 3 tools', () => {
    expect(server.tools).toHaveLength(3);
    const names = server.tools.map(t => t.name);
    expect(names).toContain('classify_product');
    expect(names).toContain('validate_classification');
    expect(names).toContain('get_duty_rates');
  });

  it('throws for unknown tool', async () => {
    await expect(
      server.executeTool('ghost', {}, makeCtx()),
    ).rejects.toThrow("Tool 'ghost' not found");
  });
});

// ===========================================================================
describe('classify_product', () => {
  it('calls searchHtsCodes then LLM and returns classification', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse({
      htsCode:          '8471.30.01',
      description:      'Portable automatic data processing machines',
      chapter:          '84',
      dutyRate:         'Free',
      confidence:       0.95,
      reasoning:        'A laptop is a portable ADP machine under Chapter 84.',
      alternativeCodes: [],
    }));

    const result = await server.executeTool(
      'classify_product',
      { productDescription: 'laptop computer 15 inch screen' },
      makeCtx(),
    );

    expect(mockSearchHts).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    const data = result.data as { htsCode: string; confidence: number };
    expect(data.htsCode).toBe('8471.30.01');
    expect(data.confidence).toBe(0.95);
  });

  it('returns success:false when no pgvector candidates found', async () => {
    mockSearchHts.mockResolvedValueOnce([]);

    const result = await server.executeTool(
      'classify_product',
      { productDescription: 'some product description here' },
      makeCtx(),
    );

    expect(result.success).toBe(false);
    expect(MOCK_CREATE).not.toHaveBeenCalled();
  });

  it('returns success:false on non-JSON LLM response', async () => {
    MOCK_CREATE.mockResolvedValue({
      content: [{ type: 'text', text: 'I cannot classify this product.' }],
      usage:   { input_tokens: 50, output_tokens: 10 },
    });

    const result = await server.executeTool(
      'classify_product',
      { productDescription: 'ambiguous product with no clear classification' },
      makeCtx(),
    );

    expect(result.success).toBe(false);
  });

  it('respects candidateCount parameter', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse({
      htsCode: '8471.30.01', description: 'test', chapter: '84',
      dutyRate: 'Free', confidence: 0.9, reasoning: 'test', alternativeCodes: [],
    }));

    await server.executeTool(
      'classify_product',
      { productDescription: 'laptop computer device', candidateCount: 3 },
      makeCtx(),
    );

    expect(mockSearchHts).toHaveBeenCalledWith(expect.any(String), 3);
  });

  it('appends context to the search query', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse({
      htsCode: '8471.30.01', description: 'test', chapter: '84',
      dutyRate: 'Free', confidence: 0.9, reasoning: 'test', alternativeCodes: [],
    }));

    await server.executeTool(
      'classify_product',
      { productDescription: 'laptop', context: 'metal casing, used in offices' },
      makeCtx(),
    );

    const searchArg = mockSearchHts.mock.calls[0]?.[0] as string;
    expect(searchArg).toContain('laptop');
    expect(searchArg).toContain('metal casing');
  });

  it('uses claude-opus-4-6 model', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse({
      htsCode: '8471.30.01', description: 'test', chapter: '84',
      dutyRate: 'Free', confidence: 0.9, reasoning: 'test', alternativeCodes: [],
    }));

    await server.executeTool(
      'classify_product',
      { productDescription: 'laptop computer' },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { model: string } | undefined;
    expect(callArg?.model).toBe('claude-opus-4-6');
  });
});

// ===========================================================================
describe('validate_classification', () => {
  it('returns isValid:true for correct classification', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse({
      isValid:     true,
      confidence:  0.92,
      issues:      [],
      explanation: 'The HTS code correctly classifies this laptop.',
    }));

    const result = await server.executeTool(
      'validate_classification',
      { htsCode: '8471.30.01', productDescription: 'laptop computer' },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    expect((result.data as { isValid: boolean }).isValid).toBe(true);
  });

  it('returns issues for wrong classification', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse({
      isValid:       false,
      confidence:    0.85,
      issues:        [{ severity: 'critical', message: 'Code is for vehicles, not electronics.' }],
      suggestedCode: '8471.30.01',
      explanation:   'The declared code does not match the product.',
    }));

    const result = await server.executeTool(
      'validate_classification',
      { htsCode: '8703.23.00', productDescription: 'laptop computer' },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as { isValid: boolean; issues: { severity: string }[] };
    expect(data.isValid).toBe(false);
    expect(data.issues[0]?.severity).toBe('critical');
  });

  it('looks up DB record for ground truth context', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse({
      isValid: true, confidence: 0.9, issues: [], explanation: 'ok',
    }));

    await server.executeTool(
      'validate_classification',
      { htsCode: '8471.30.01', productDescription: 'laptop' },
      makeCtx(),
    );

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { code: '8471.30.01' } });
  });

  it('uses claude-haiku-4-5-20251001 model', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse({
      isValid: true, confidence: 0.9, issues: [], explanation: 'ok',
    }));

    await server.executeTool(
      'validate_classification',
      { htsCode: '8471.30.01', productDescription: 'laptop' },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as { model: string } | undefined;
    expect(callArg?.model).toBe('claude-haiku-4-5-20251001');
  });

  it('includes declaredDutyRate in prompt when provided', async () => {
    MOCK_CREATE.mockResolvedValue(makeAnthropicResponse({
      isValid: true, confidence: 0.9, issues: [], explanation: 'ok',
    }));

    await server.executeTool(
      'validate_classification',
      { htsCode: '8471.30.01', productDescription: 'laptop', declaredDutyRate: '5%' },
      makeCtx(),
    );

    const callArg = MOCK_CREATE.mock.calls[0]?.[0] as
      { messages: { content: string }[] } | undefined;
    expect(callArg?.messages[0]?.content).toContain('5%');
  });
});

// ===========================================================================
describe('get_duty_rates', () => {
  it('returns duty rate from DB without calling LLM', async () => {
    const result = await server.executeTool(
      'get_duty_rates',
      { htsCode: '8471.30.01' },
      makeCtx(),
    );

    expect(MOCK_CREATE).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    const data = result.data as { dutyRate: string; found: boolean };
    expect(data.dutyRate).toBe('Free');
    expect(data.found).toBe(true);
  });

  it('returns found:false for unknown HTS code', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const result = await server.executeTool(
      'get_duty_rates',
      { htsCode: '9999.99.99' },
      makeCtx(),
    );

    expect(result.success).toBe(true);
    const data = result.data as { found: boolean; htsCode: string };
    expect(data.found).toBe(false);
    expect(data.htsCode).toBe('9999.99.99');
  });

  it('never calls trackedCall (no LLM usage to track)', async () => {
    mockTrackedCall.mockClear();

    await server.executeTool('get_duty_rates', { htsCode: '8471.30.01' }, makeCtx());

    expect(mockTrackedCall).not.toHaveBeenCalled();
  });

  it('returns correct chapter from DB record', async () => {
    const result = await server.executeTool(
      'get_duty_rates',
      { htsCode: '8471.30.01' },
      makeCtx(),
    );

    expect((result.data as { chapter: string }).chapter).toBe('84');
  });

  it('returns chapter from HTS code prefix when not found in DB', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const result = await server.executeTool(
      'get_duty_rates',
      { htsCode: '8703.23.00' },
      makeCtx(),
    );

    expect((result.data as { chapter: string }).chapter).toBe('87');
  });
});
