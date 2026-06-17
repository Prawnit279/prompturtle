import { TIER_LIMITS, TenantTier, type BolType } from '@prompturtle/shared';

import { prisma } from './db.js';
import logger from './logger.js';
import { checkAndWarnUsage } from './usage-monitor.js';

// ---- Model pricing (per 1K tokens) ----

const MODEL_COSTS = {
  'claude-opus-4-6': { input: 0.015, output: 0.075 },
  'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
  'claude-haiku-4-5-20251001': { input: 0.00025, output: 0.00125 },
} as const;

export type ModelName = keyof typeof MODEL_COSTS;

const DEFAULT_MODEL: ModelName = 'claude-haiku-4-5-20251001';

// ---- Errors ----

export class TierLimitExceededError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly tier: TenantTier,
    public readonly limitType: 'callsPerMinute' | 'callsPerMonth',
    public readonly current: number,
    public readonly max: number,
  ) {
    super(`Rate limit exceeded (${tier}): ${limitType} ${current}/${max}`);
    this.name = 'TierLimitExceededError';
  }
}

// ---- Call options ----

export interface TrackedCallOptions {
  tenantId: string;
  mcpServer: string;
  toolName: string;
  /** Optional — defaults to claude-haiku when not supplied (e.g. called from BaseMCPServer). */
  model?: ModelName;
  tier: TenantTier;
  /** Optional — set by BOL Processor tools so tool_calls.bol_type is populated for analytics. */
  bolType?: BolType;
}

// ---- Main export ----

/**
 * Wraps any Claude API call with:
 * 1. Tier limit enforcement (callsPerMinute + callsPerMonth)
 * 2. Latency measurement
 * 3. ToolCall record written to DB with token costs
 *
 * ALL Claude API calls must go through this. No raw anthropic.messages.create elsewhere.
 */
export async function trackedCall<T>(
  options: TrackedCallOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const { tenantId, mcpServer, toolName, tier, bolType } = options;
  const model: ModelName = options.model ?? DEFAULT_MODEL;
  const limits = TIER_LIMITS[tier];

  // ---- 1. Check per-minute rate limit ----
  // ⚠️  H-2 KNOWN RACE: This is a check-then-act pattern with no DB-level lock.
  // Concurrent requests from the same tenant can all read the count as N (below limit),
  // all pass, and all write — exceeding the per-minute budget.
  // TODO: Replace with Redis INCR + EXPIRE for atomic per-tenant rate limiting in production.
  //       Alternatively, use pg_advisory_xact_lock keyed on tenantId inside a transaction
  //       that covers both the count read and the placeholder record write.
  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const callsThisMinute = await prisma.toolCall.count({
    where: {
      tenant_id: tenantId,
      created_at: { gte: oneMinuteAgo },
    },
  });

  if (callsThisMinute >= limits.callsPerMinute) {
    throw new TierLimitExceededError(
      tenantId,
      tier,
      'callsPerMinute',
      callsThisMinute,
      limits.callsPerMinute,
    );
  }

  // ---- 2. Check monthly limit ----
  // Use UTC so the window is consistent regardless of server timezone (M-1).
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const callsThisMonth = await prisma.toolCall.count({
    where: {
      tenant_id: tenantId,
      created_at: { gte: startOfMonth },
    },
  });

  if (callsThisMonth >= limits.callsPerMonth) {
    throw new TierLimitExceededError(
      tenantId,
      tier,
      'callsPerMonth',
      callsThisMonth,
      limits.callsPerMonth,
    );
  }

  // ---- 3. Execute ----
  const startMs = Date.now();
  let result: T;
  let tokenUsage = { inputTokens: 0, outputTokens: 0 };

  try {
    result = await fn();

    // Extract token usage if the result looks like an Anthropic response
    const maybeResponse = result as Record<string, unknown>;
    if (maybeResponse != null && typeof maybeResponse === 'object' && 'usage' in maybeResponse) {
      const usage = maybeResponse.usage as Record<string, unknown>;
      tokenUsage = {
        inputTokens: typeof usage['input_tokens'] === 'number' ? usage['input_tokens'] : 0,
        outputTokens: typeof usage['output_tokens'] === 'number' ? usage['output_tokens'] : 0,
      };
    }
  } catch (err) {
    // Record failed call with zero tokens, then re-throw
    await writeToolCallRecord({
      tenantId,
      mcpServer,
      toolName,
      model,
      latencyMs: Date.now() - startMs,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      success: false,
      bolType: bolType ?? null,
    });
    throw err;
  }

  const latencyMs = Date.now() - startMs;
  const costs = MODEL_COSTS[model];
  const costUsd =
    (tokenUsage.inputTokens / 1000) * costs.input +
    (tokenUsage.outputTokens / 1000) * costs.output;

  await writeToolCallRecord({
    tenantId,
    mcpServer,
    toolName,
    model,
    latencyMs,
    inputTokens: tokenUsage.inputTokens,
    outputTokens: tokenUsage.outputTokens,
    costUsd,
    success: true,
    bolType: bolType ?? null,
  });

  // Fire-and-forget usage warning — do not await; must not block or throw in request path
  void checkAndWarnUsage(tenantId, tier, callsThisMonth + 1);

  logger.info(
    {
      tenantId,
      mcpServer,
      toolName,
      model,
      latencyMs,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      costUsd: costUsd.toFixed(6),
    },
    'cost-tracker.call.recorded',
  );

  return result!;
}

// ---- Private helpers ----

interface ToolCallRecord {
  tenantId: string;
  mcpServer: string;
  toolName: string;
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  success: boolean;
  /** Populated only for BOL Processor calls; null for all other MCP servers. */
  bolType: BolType | null;
}

async function writeToolCallRecord(record: ToolCallRecord): Promise<void> {
  try {
    await prisma.toolCall.create({
      data: {
        tenant_id: record.tenantId,
        mcp_server: record.mcpServer,
        tool_name: record.toolName,
        model_used: record.model,
        latency_ms: record.latencyMs,
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
        cost_usd: record.costUsd,
        success: record.success,
        bol_type: record.bolType,
      },
    });
  } catch (err) {
    // Never let a DB write failure crash the user's actual request
    logger.error({ err, record }, 'cost-tracker.write.failed');
  }
}

// ---- Utility: compute cost for a known usage ----

export function computeCost(
  model: ModelName,
  inputTokens: number,
  outputTokens: number,
): number {
  const costs = MODEL_COSTS[model];
  return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
}
