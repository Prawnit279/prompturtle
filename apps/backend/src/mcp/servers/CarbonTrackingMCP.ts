import { BaseMCPServer } from '../BaseMCPServer.js';
import { NotImplementedError } from '../types.js';
import type { ToolCallContext, ToolCallResult, ToolDefinition } from '../types.js';

/**
 * Carbon Tracking MCP — Phase 2 feature (not available in v1).
 * All tools throw NotImplementedError with a roadmap message.
 * Occupies the registry slot to prevent crashes on early API calls.
 */
export class CarbonTrackingMCP extends BaseMCPServer {
  readonly name    = 'carbon-tracking';
  readonly version = '0.0.0-stub';

  readonly tools: ToolDefinition[] = [
    {
      name:        'calculate_carbon_footprint',
      description: '[Phase 2] Calculate carbon footprint for a shipment. Not available in v1.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name:        'get_carbon_offset_options',
      description: '[Phase 2] Retrieve carbon offset options for a shipment. Not available in v1.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name:        'generate_emissions_report',
      description: '[Phase 2] Generate an emissions report for a date range. Not available in v1.',
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
      'Carbon tracking is a Phase 2 feature and is not available in the current plan. ' +
      'Contact sales@prompturtle.com to discuss early access.',
    );
  }
}
