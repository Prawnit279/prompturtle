/**
 * DB-level RLS isolation test.
 *
 * Gated on RLS_E2E=1 — requires APP_DB_URL pointing to a non-superuser
 * Postgres role (app_user) so RLS policies are actually enforced.
 *
 * Run locally: RLS_E2E=1 APP_DB_URL=<dsn> npx vitest run src/lib/__tests__/db.rls.test.ts
 *
 * NEVER connect via superuser (postgres role) for these tests —
 * superuser bypasses RLS silently and isolation tests would pass vacuously.
 */
import { describe, expect, it } from 'vitest';

import { TenantContextMissingError } from '../db.js';
import { runWithTenant } from '../tenantContext.js';

const RLS_E2E = Boolean(process.env.RLS_E2E);

describe.skipIf(!RLS_E2E)('DB RLS isolation (RLS_E2E=1 required)', () => {
  it('throws TenantContextMissingError when called outside tenant context', async () => {
    const { db } = await import('../db.js');
    await expect(db.tenant.findMany()).rejects.toThrow(TenantContextMissingError);
  });

  it('tenant A data is invisible to tenant B', async () => {
    const { db } = await import('../db.js');

    const tenantA = crypto.randomUUID();
    const tenantB = crypto.randomUUID();

    // Insert a tenant row as tenant A (tenants.id = tenantId per our RLS policy)
    await runWithTenant({ tenantId: tenantA }, async () => {
      await db.tenant.create({
        data: { id: tenantA, name: 'Tenant A', tier: 'STARTER' },
      });
    });

    // Insert a tool_call under tenant A
    await runWithTenant({ tenantId: tenantA }, async () => {
      await db.toolCall.create({
        data: {
          tenant_id: tenantA,
          mcp_server: 'test-server',
          tool_name: 'test-tool',
          model_used: 'claude',
          input_tokens: 100,
          output_tokens: 50,
          cost_usd: 0.001,
          latency_ms: 120,
        },
      });
    });

    // Query as tenant B — should see nothing
    const results = await runWithTenant({ tenantId: tenantB }, async () => {
      return db.toolCall.findMany();
    });

    expect(results).toHaveLength(0);
  });
});

describe('TenantContextMissingError (no DB needed)', () => {
  it('has correct name and message', () => {
    const err = new TenantContextMissingError();
    expect(err.name).toBe('TenantContextMissingError');
    expect(err.message).toContain('tenant context');
  });
});
