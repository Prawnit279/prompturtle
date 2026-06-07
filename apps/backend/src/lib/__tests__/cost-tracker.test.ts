import { TenantTier } from '@prompturtle/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ModelName,
  TierLimitExceededError,
  computeCost,
  trackedCall,
} from '../cost-tracker.js';

// ---- Prisma mock ----
vi.mock('../db.js', () => ({
  prisma: {
    toolCall: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
  // Keep other exports intact
  TenantContextMissingError: class TenantContextMissingError extends Error {},
}));

// ---- Usage monitor mock — suppress email side-effect from fire-and-forget ----
vi.mock('../usage-monitor.js', () => ({
  checkAndWarnUsage: vi.fn().mockResolvedValue(undefined),
}));

// ---- Logger mock (default export) ----
vi.mock('../logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

import { prisma } from '../db.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as unknown as {
  toolCall: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

// ---- Helpers ----

const defaultOptions = {
  tenantId: 'tenant-abc',
  mcpServer: 'bol-processor',
  toolName: 'parse-bol',
  model: 'claude-haiku-4-5-20251001' as ModelName,
  tier: TenantTier.STARTER,
};

function makeAnthropicResponse(inputTokens: number, outputTokens: number) {
  return {
    content: [],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no calls recorded yet (under limits)
  mockPrisma.toolCall.count.mockResolvedValue(0);
  mockPrisma.toolCall.create.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---- Tests ----

describe('trackedCall', () => {
  it('executes fn and returns result', async () => {
    const response = makeAnthropicResponse(100, 50);
    const result = await trackedCall(defaultOptions, async () => response);
    expect(result).toBe(response);
  });

  it('writes ToolCall record to DB on success with correct fields', async () => {
    await trackedCall(defaultOptions, async () => makeAnthropicResponse(100, 50));
    expect(mockPrisma.toolCall.create).toHaveBeenCalledOnce();
    const createArg = mockPrisma.toolCall.create.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >;
    expect(createArg?.tenant_id).toBe('tenant-abc');
    expect(createArg?.success).toBe(true);
    expect(createArg?.input_tokens).toBe(100);
    expect(createArg?.output_tokens).toBe(50);
  });

  it('writes bol_type to the ToolCall record when the caller supplies it', async () => {
    await trackedCall(
      { ...defaultOptions, bolType: 'AIR_WAYBILL' },
      async () => makeAnthropicResponse(100, 50),
    );
    const createArg = mockPrisma.toolCall.create.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >;
    expect(createArg?.bol_type).toBe('AIR_WAYBILL');
  });

  it('writes bol_type as null when the caller omits it (non-BOL servers)', async () => {
    await trackedCall(defaultOptions, async () => makeAnthropicResponse(100, 50));
    const createArg = mockPrisma.toolCall.create.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >;
    expect(createArg?.bol_type).toBeNull();
  });

  it('writes bol_type as null on a failed call when the caller omits it', async () => {
    const boom = new Error('network failure');
    await expect(
      trackedCall(defaultOptions, async () => {
        throw boom;
      }),
    ).rejects.toThrow('network failure');

    const createArg = mockPrisma.toolCall.create.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >;
    expect(createArg?.bol_type).toBeNull();
  });

  it('writes failed ToolCall record and re-throws on error', async () => {
    const boom = new Error('network failure');
    await expect(
      trackedCall(defaultOptions, async () => {
        throw boom;
      }),
    ).rejects.toThrow('network failure');

    expect(mockPrisma.toolCall.create).toHaveBeenCalledOnce();
    const createArg = mockPrisma.toolCall.create.mock.calls[0]?.[0]?.data as Record<
      string,
      unknown
    >;
    expect(createArg?.success).toBe(false);
  });

  it('throws TierLimitExceededError when callsPerMinute exceeded', async () => {
    // STARTER limit is 10/min
    mockPrisma.toolCall.count.mockResolvedValue(10);

    await expect(trackedCall(defaultOptions, async () => ({}))).rejects.toThrow(
      TierLimitExceededError,
    );
  });

  it('throws TierLimitExceededError when callsPerMonth exceeded', async () => {
    // First count (per-minute) = 0, second count (per-month) = STARTER limit
    mockPrisma.toolCall.count
      .mockResolvedValueOnce(0) // per-minute check: under limit
      .mockResolvedValueOnce(1_000); // per-month check: at limit (STARTER = 1000)

    await expect(trackedCall(defaultOptions, async () => ({}))).rejects.toThrow(
      TierLimitExceededError,
    );
  });

  it('does not throw when under both limits', async () => {
    mockPrisma.toolCall.count.mockResolvedValue(0);
    await expect(
      trackedCall(defaultOptions, async () => ({ result: 'ok' })),
    ).resolves.toEqual({ result: 'ok' });
  });

  it('never throws if DB write fails (fire-and-forget safety)', async () => {
    mockPrisma.toolCall.create.mockRejectedValue(new Error('db down'));
    // Should not throw even though the DB write failed
    await expect(
      trackedCall(defaultOptions, async () => makeAnthropicResponse(10, 5)),
    ).resolves.toBeDefined();
  });

  it('works without model field (defaults to haiku)', async () => {
    const { model: _model, ...optsWithoutModel } = defaultOptions;
    await expect(
      trackedCall(optsWithoutModel, async () => makeAnthropicResponse(10, 5)),
    ).resolves.toBeDefined();
  });
});

describe('computeCost', () => {
  it('correctly prices haiku', () => {
    // 1000 input × $0.00025/1K + 1000 output × $0.00125/1K
    const cost = computeCost('claude-haiku-4-5-20251001', 1000, 1000);
    expect(cost).toBeCloseTo(0.0015, 6);
  });

  it('correctly prices opus', () => {
    // 1000 input × $0.015/1K + 1000 output × $0.075/1K
    const cost = computeCost('claude-opus-4-6', 1000, 1000);
    expect(cost).toBeCloseTo(0.09, 6);
  });

  it('returns 0 for zero tokens', () => {
    expect(computeCost('claude-sonnet-4-6', 0, 0)).toBe(0);
  });
});
