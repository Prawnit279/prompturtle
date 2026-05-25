import { BaseMCPServer } from '../BaseMCPServer.js';
import { NotImplementedError } from '../types.js';
import type { ToolCallContext, ToolCallResult, ToolDefinition } from '../types.js';

/**
 * Supplier Risk MCP — Phase 2 feature (not available in v1).
 * All tools throw NotImplementedError with a roadmap message.
 */
export class SupplierRiskMCP extends BaseMCPServer {
  readonly name    = 'supplier-risk';
  readonly version = '0.0.0-stub';

  readonly tools: ToolDefinition[] = [
    {
      name:        'score_supplier_risk',
      description: "[Phase 2] Score a supplier's risk profile. Not available in v1.",
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name:        'get_supplier_alerts',
      description: '[Phase 2] Get active risk alerts for a supplier. Not available in v1.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name:        'recommend_supplier_alternatives',
      description: '[Phase 2] Recommend alternative suppliers based on risk. Not available in v1.',
      inputSchema: { type: 'object', properties: {} },
    },
  ];

  async executeTool(
    toolName: string,
    _input: unknown,
    _ctx: ToolCallContext,
  ): Promise<ToolCallResult> {
    this.assertToolExists(toolName);
    throw new NotImplementedError(
      'Supplier risk scoring is a Phase 2 feature and is not available in the current plan. ' +
      'Contact sales@prompturtle.com to discuss early access.',
    );
  }
}
