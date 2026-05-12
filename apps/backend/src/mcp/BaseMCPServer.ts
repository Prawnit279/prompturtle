import logger from '../lib/logger.js';

import { enforceGuardrails, trackedCall } from './stubs.js';
import type { ToolCallContext, ToolCallResult, ToolDefinition } from './types.js';

export abstract class BaseMCPServer {
  /** Unique server identifier used in registry lookups and audit logs */
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly tools: ToolDefinition[];

  /**
   * Implement this in each concrete server.
   * Called only after guardrails pass and inside the cost-tracker wrapper.
   */
  abstract executeTool(
    toolName: string,
    input: unknown,
    ctx: ToolCallContext,
  ): Promise<ToolCallResult>;

  /**
   * Public entry point for all tool calls.
   * Order: guardrails → cost tracking → executeTool
   * Do NOT override this in subclasses.
   */
  async call(
    toolName: string,
    input: unknown,
    ctx: ToolCallContext,
  ): Promise<ToolCallResult> {
    const log = logger.child({
      mcpServer: this.name,
      toolName,
      tenantId: ctx.tenantId,
      requestId: ctx.requestId,
    });

    log.info('mcp.call.start');

    // Step 1: Guardrails (no-op stub until PR 2.4)
    await enforceGuardrails(ctx);

    // Step 2: Cost-tracked execution (pass-through stub until PR 2.3)
    const result = await trackedCall(
      {
        tenantId: ctx.tenantId,
        mcpServer: this.name,
        toolName,
        tier: ctx.tier,
      },
      () => this.executeTool(toolName, input, ctx),
    );

    log.info({ success: result.success }, 'mcp.call.end');
    return result;
  }

  /** Returns the ToolDefinition for a given name, or undefined */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.find((t) => t.name === name);
  }

  /** Validates that `toolName` is registered on this server */
  protected assertToolExists(toolName: string): ToolDefinition {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(
        `Tool '${toolName}' not found on server '${this.name}'. ` +
          `Available: ${this.tools.map((t) => t.name).join(', ')}`,
      );
    }
    return tool;
  }
}
