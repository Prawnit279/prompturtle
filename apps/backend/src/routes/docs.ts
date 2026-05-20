import { Router } from 'express';

const router = Router();

/**
 * GET /api/docs
 * Returns the OpenAPI 3.1 spec for all Prompturtle endpoints.
 * No authentication required — public endpoint for vendor integration.
 */
router.get('/', (_req, res) => {
  res.json(openApiSpec);
});

const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title:       'Prompturtle Context Engine API',
    version:     '1.0.0',
    description: 'Supply chain context engineering platform. Embed AI-powered MCP servers into your SC software.',
    contact: {
      name:  'Prompturtle Support',
      email: 'support@prompturtle.com',
    },
  },
  servers: [
    { url: 'https://api.prompturtle.com', description: 'Production' },
    { url: 'http://localhost:3000',        description: 'Local development' },
  ],
  security: [{ BearerAuth: [] }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type:         'http',
        scheme:       'bearer',
        bearerFormat: 'JWT',
        description:  'Clerk session token. Valid for 60 seconds — refresh before each request.',
      },
    },
    schemas: {
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data:    { type: 'object' },
          meta: {
            type: 'object',
            properties: {
              model:      { type: 'string' },
              tokensUsed: { type: 'number' },
              latencyMs:  { type: 'number' },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error:   { type: 'string' },
          code:    { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        summary:     'Health check',
        operationId: 'getHealth',
        security:    [],
        responses: {
          '200': {
            description: 'Server is healthy',
            content: { 'application/json': { schema: { type: 'object', properties: {
              status:    { type: 'string', example: 'ok' },
              version:   { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            }}}},
          },
        },
      },
    },
    '/api/mcp/{serverName}/{toolName}': {
      post: {
        summary:     'Execute an MCP tool',
        operationId: 'executeMcpTool',
        parameters: [
          {
            name: 'serverName', in: 'path', required: true,
            schema: {
              type: 'string',
              enum: ['bol-processor', 'carrier-rates', 'hts-classifier'],
            },
            description: 'MCP server identifier',
          },
          {
            name: 'toolName', in: 'path', required: true,
            schema: { type: 'string' },
            description: 'Tool name — see API.md for per-server tool lists',
          },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          '200': {
            description: 'Tool executed successfully',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '400': {
            description: 'Invalid input',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Guardrail violation' },
          '429': { description: 'Tier limit exceeded' },
          '501': { description: 'Feature not yet implemented (Phase 2 stub)' },
        },
      },
    },
    '/api/approvals': {
      get: {
        summary:     'List pending approval requests',
        operationId: 'listApprovals',
        responses: {
          '200': { description: 'Pending approvals for the authenticated tenant' },
        },
      },
    },
    '/api/approvals/{id}/decide': {
      post: {
        summary:     'Record an approval decision',
        operationId: 'decideApproval',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              decision: { type: 'string', enum: ['APPROVED', 'REJECTED', 'ESCALATED'] },
              reason:   { type: 'string' },
            },
            required: ['decision'],
          }}},
        },
        responses: {
          '200': { description: 'Decision recorded' },
          '400': { description: 'Request already decided or not found' },
          '403': { description: 'Cross-tenant access rejected' },
        },
      },
    },
  },
};

export default router;
