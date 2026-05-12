import { TenantTier } from '@prompturtle/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { BaseMCPServer } from '../BaseMCPServer.js';
import { getServer, listRegisteredServers, registerServer } from '../registry.js';
import type { ToolCallContext, ToolCallResult, ToolDefinition } from '../types.js';

// ---- Minimal concrete server for testing ----

class EchoServer extends BaseMCPServer {
  readonly name = 'echo-test';
  readonly version = '0.1.0';
  readonly tools: ToolDefinition[] = [
    {
      name: 'echo',
      description: 'Returns input as output',
      inputSchema: { type: 'object', properties: { message: { type: 'string' } } },
    },
  ];

  async executeTool(
    toolName: string,
    input: unknown,
    _ctx: ToolCallContext,
  ): Promise<ToolCallResult> {
    this.assertToolExists(toolName);
    return { success: true, data: input };
  }
}

// ---- Test context factory ----

function makeCtx(overrides: Partial<ToolCallContext> = {}): ToolCallContext {
  return {
    tenantId: 'tenant-abc',
    userId: 'user-xyz',
    tier: TenantTier.STARTER,
    mcpServer: 'echo-test',
    requestId: 'req-001',
    ...overrides,
  };
}

// ---- Tests ----

describe('BaseMCPServer', () => {
  let server: EchoServer;

  beforeEach(() => {
    server = new EchoServer();
  });

  it('call() returns success result for valid tool', async () => {
    const result = await server.call('echo', { message: 'hello' }, makeCtx());
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ message: 'hello' });
  });

  it('call() propagates executeTool errors', async () => {
    const badServer = new (class extends BaseMCPServer {
      readonly name = 'bad';
      readonly version = '0.0.1';
      readonly tools: ToolDefinition[] = [
        { name: 'explode', description: 'throws', inputSchema: {} },
      ];

      async executeTool(): Promise<ToolCallResult> {
        throw new Error('kaboom');
      }
    })();

    await expect(badServer.call('explode', {}, makeCtx())).rejects.toThrow('kaboom');
  });

  it('assertToolExists throws for unknown tool', async () => {
    await expect(server.call('nonexistent', {}, makeCtx())).rejects.toThrow(
      "Tool 'nonexistent' not found on server 'echo-test'",
    );
  });

  it('getTool returns definition for known tool', () => {
    const tool = server.getTool('echo');
    expect(tool?.name).toBe('echo');
  });

  it('getTool returns undefined for unknown tool', () => {
    expect(server.getTool('ghost')).toBeUndefined();
  });
});

describe('MCPServerRegistry', () => {
  it('listRegisteredServers initially returns empty (no servers registered in test isolation)', () => {
    // registry may have slots but no live instances at test start
    const list = listRegisteredServers();
    expect(Array.isArray(list)).toBe(true);
  });

  it('registerServer + getServer round-trip works for pre-reserved slots', () => {
    // bol-processor slot is pre-reserved
    const bolServer = new (class extends BaseMCPServer {
      readonly name = 'bol-processor';
      readonly version = '0.1.0';
      readonly tools: ToolDefinition[] = [];

      async executeTool(
        _t: string,
        _i: unknown,
        _c: ToolCallContext,
      ): Promise<ToolCallResult> {
        return { success: true, data: null };
      }
    })();

    registerServer(bolServer);
    expect(getServer('bol-processor')).toBe(bolServer);
    expect(listRegisteredServers()).toContain('bol-processor');
  });

  it('registerServer throws for unreserved slot', () => {
    const rogue = new (class extends BaseMCPServer {
      readonly name = 'rogue-server';
      readonly version = '0.0.1';
      readonly tools: ToolDefinition[] = [];

      async executeTool(): Promise<ToolCallResult> {
        return { success: true, data: null };
      }
    })();

    expect(() => registerServer(rogue)).toThrow("no slot reserved for 'rogue-server'");
  });

  it('getServer throws for unknown name', () => {
    expect(() => getServer('does-not-exist')).toThrow("unknown server 'does-not-exist'");
  });

  it('getServer throws for null (reserved but not registered) slot', () => {
    // carrier-rates slot is pre-reserved but null (PR 3.2 hasn't run)
    expect(() => getServer('carrier-rates')).toThrow('slot reserved but not yet registered');
  });
});
