import { TenantTier } from '@prompturtle/shared';
import { z } from 'zod';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks (before imports that use them) ----

vi.mock('../../lib/db.js', () => ({
  prisma: {
    toolCall:   { count:  vi.fn().mockResolvedValue(0) },
    auditEvent: { create: vi.fn().mockResolvedValue({}) },
  },
  TenantContextMissingError: class TenantContextMissingError extends Error {},
}));

vi.mock('../../lib/audit.js', () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/webhook-service.js', () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/logger.js', () => ({
  default: {
    warn:  vi.fn(),
    info:  vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

import { writeAuditEvent } from '../../lib/audit.js';
import { dispatch } from '../../lib/webhook-service.js';
import { prisma } from '../../lib/db.js';

import { GuardrailEngine } from '../GuardrailEngine.js';
import { InputSchemaRule, registerToolSchema } from '../rules/InputSchemaRule.js';
import { RateLimitRule } from '../rules/RateLimitRule.js';
import { TenantScopeRule } from '../rules/TenantScopeRule.js';
import { GuardrailViolationError } from '../../mcp/types.js';

const mockWriteAudit = writeAuditEvent as ReturnType<typeof vi.fn>;
const mockDispatch   = dispatch as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  toolCall: { count: ReturnType<typeof vi.fn> };
};

// ---- Context factory ----

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    tenantId:  'tenant-aaa',
    userId:    'user-001',
    tier:      TenantTier.STARTER,
    mcpServer: 'bol-processor',
    requestId: 'req-001',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- GuardrailEngine ----

describe('GuardrailEngine', () => {
  const engine = new GuardrailEngine();

  beforeEach(() => {
    // InputSchemaRule is now fail-closed — register schema so engine tests can proceed
    registerToolSchema('bol-processor', 'parse-bol', z.object({}).passthrough());
  });

  it('passes when no rules fire', async () => {
    mockPrisma.toolCall.count.mockResolvedValue(0);
    await expect(engine.enforce(makeCtx(), 'parse-bol', {})).resolves.toBeUndefined();
  });

  it('throws GuardrailViolationError on first violation', async () => {
    // Rate limit exceeded — STARTER = 10/min
    mockPrisma.toolCall.count.mockResolvedValue(10);
    await expect(engine.enforce(makeCtx(), 'parse-bol', {})).rejects.toThrow(
      GuardrailViolationError,
    );
  });

  it('writes audit event on violation', async () => {
    mockPrisma.toolCall.count.mockResolvedValue(10);
    await expect(engine.enforce(makeCtx(), 'parse-bol', {})).rejects.toThrow();
    expect(mockWriteAudit).toHaveBeenCalledOnce();
    expect(mockWriteAudit.mock.calls[0]?.[0]?.action).toBe('GUARDRAIL_VIOLATION');
  });

  it('dispatches a decision.halted webhook on violation', async () => {
    mockPrisma.toolCall.count.mockResolvedValue(10);
    await expect(engine.enforce(makeCtx(), 'parse-bol', {})).rejects.toThrow();
    expect(mockDispatch).toHaveBeenCalledWith(
      'tenant-aaa',
      'decision.halted',
      expect.objectContaining({ mcpServer: 'bol-processor', toolName: 'parse-bol' }),
    );
  });
});

// ---- RateLimitRule ----

describe('RateLimitRule', () => {
  const rule = new RateLimitRule();

  it('passes when under limit', async () => {
    mockPrisma.toolCall.count.mockResolvedValue(5);
    expect(await rule.check('tool', {}, makeCtx())).toBeNull();
  });

  it('violates when at limit', async () => {
    mockPrisma.toolCall.count.mockResolvedValue(10); // STARTER = 10
    expect(await rule.check('tool', {}, makeCtx())).not.toBeNull();
  });

  it('GROWTH tier has higher limit (60/min)', async () => {
    mockPrisma.toolCall.count.mockResolvedValue(50); // over STARTER (10), under GROWTH (60)
    const ctx = makeCtx({ tier: TenantTier.GROWTH });
    expect(await rule.check('tool', {}, ctx)).toBeNull();
  });
});

// ---- InputSchemaRule ----

describe('InputSchemaRule', () => {
  const rule = new InputSchemaRule();

  beforeEach(() => {
    registerToolSchema(
      'bol-processor',
      'parse-bol',
      z.object({ bolNumber: z.string().min(1) }),
    );
  });

  it('passes valid input', async () => {
    const result = await rule.check('parse-bol', { bolNumber: 'BOL-123' }, makeCtx());
    expect(result).toBeNull();
  });

  it('violates on invalid input', async () => {
    const result = await rule.check('parse-bol', { bolNumber: '' }, makeCtx());
    expect(result?.rule).toBe('InputSchemaRule');
  });

  it('blocks if no schema registered for tool (fail-closed, M-2)', async () => {
    const result = await rule.check('unknown-tool', { anything: true }, makeCtx());
    expect(result?.rule).toBe('InputSchemaRule');
  });
});

// ---- TenantScopeRule ----

describe('TenantScopeRule', () => {
  const rule = new TenantScopeRule();

  it('passes when tenantId matches caller', async () => {
    const input = { tenantId: 'tenant-aaa', data: 'foo' };
    expect(await rule.check('tool', input, makeCtx())).toBeNull();
  });

  it('violates when tenantId differs from caller', async () => {
    const input = { tenantId: 'tenant-zzz' };
    const result = await rule.check('tool', input, makeCtx());
    expect(result?.rule).toBe('TenantScopeRule');
  });

  it('passes on nested matching tenantId', async () => {
    const input = { nested: { tenantId: 'tenant-aaa' } };
    expect(await rule.check('tool', input, makeCtx())).toBeNull();
  });

  it('violates on nested mismatched tenantId', async () => {
    const input = { nested: { tenantId: 'tenant-evil' } };
    const result = await rule.check('tool', input, makeCtx());
    expect(result).not.toBeNull();
  });

  it('passes for non-object input', async () => {
    expect(await rule.check('tool', null, makeCtx())).toBeNull();
    expect(await rule.check('tool', 'string-input', makeCtx())).toBeNull();
  });
});
