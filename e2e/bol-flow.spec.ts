/**
 * BOL Processing API — E2E tests.
 *
 * BLOCKER: /api/mcp/bol/parse and /api/mcp/bol/validate endpoints do not yet exist.
 * The MCP servers (BolProcessorMCP) are registered in app.ts but have no HTTP route
 * handlers. These tests will fail with 404 until the MCP REST routes are added.
 * Tracked as: TODO — add /api/mcp/* route handlers in a future PR.
 */
import { test, expect } from '@playwright/test';

import { apiRequest } from './helpers/api.js';

test.describe('BOL Processing API', () => {
  test('parses a valid BOL and returns structured output', async () => {
    const start = Date.now();

    const response = await apiRequest('/api/mcp/bol/parse', {
      method: 'POST',
      body:   JSON.stringify({
        rawBol: `
          BILL OF LADING
          Shipper: Acme Corp, 123 Main St, Chicago IL 60601
          Consignee: Beta Logistics, 456 Oak Ave, Dallas TX 75201
          Carrier: XPO Logistics
          PRO#: 123456789
          Weight: 5,000 lbs
          Commodity: Electronic Components
          Freight Class: 85
          Declared Value: $8,500
        `,
      }),
    });

    const latencyMs = Date.now() - start;

    expect(response.status).toBe(200);
    expect(latencyMs).toBeLessThan(500); // p95 target

    const body = await response.json() as Record<string, unknown>;
    expect(body).toHaveProperty('shipper');
    expect(body).toHaveProperty('consignee');
    expect(body).toHaveProperty('carrier');
  });

  test('validates a BOL with compliance flags', async () => {
    const response = await apiRequest('/api/mcp/bol/validate', {
      method: 'POST',
      body:   JSON.stringify({
        bolData: {
          shipper:         { name: 'Acme Corp', address: '123 Main St, Chicago IL' },
          consignee:       { name: 'Beta Logistics', address: '456 Oak Ave, Dallas TX' },
          carrier:         'XPO Logistics',
          weight:          5000,
          declaredValue:   8500,
          customsRequired: false,
        },
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body).toHaveProperty('valid');
    expect(body).toHaveProperty('guardrailsFired');
  });

  test('triggers high_cost guardrail for shipments over $10,000', async () => {
    const response = await apiRequest('/api/mcp/bol/validate', {
      method: 'POST',
      body:   JSON.stringify({
        bolData: {
          shipper:         { name: 'Acme Corp', address: '123 Main St' },
          consignee:       { name: 'Beta Logistics', address: '456 Oak Ave' },
          carrier:         'FedEx',
          weight:          10000,
          declaredValue:   15000, // Over $10,000 threshold — triggers HIGH_SHIPMENT_COST approval
          customsRequired: false,
        },
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json() as { guardrailsFired?: string[] };
    expect(body.guardrailsFired).toContain('high_cost_approval');
  });

  test('rejects unauthenticated BOL requests', async () => {
    const apiBase = process.env.E2E_API_URL ?? 'http://localhost:3000';
    const response = await fetch(`${apiBase}/api/mcp/bol/parse`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ rawBol: 'test' }),
    });
    expect(response.status).toBe(401);
  });
});
