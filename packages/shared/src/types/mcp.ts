export interface MCPToolCall {
  id: string;
  toolName: string;
  serverId: string;
  input: Record<string, unknown>;
  calledAt: string;
}

export interface MCPToolResult {
  toolCallId: string;
  output: unknown;
  error: string | null;
  durationMs: number;
}

/** JSON-Schema-shaped descriptor kept loose to avoid pulling a schema library. */
export interface MCPToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPServerManifest {
  id: string;
  name: string;
  version: string;
  tools: MCPToolDescriptor[];
}
