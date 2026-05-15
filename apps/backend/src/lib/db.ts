import { PrismaClient } from '@prisma/client';

import { getTenantId } from './tenantContext';

/** Strict UUID v4 regex — validated before SQL interpolation to prevent injection. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TenantContextMissingError extends Error {
  constructor() {
    super('DB query attempted outside a tenant context. Wrap handlers with withTenantContext.');
    this.name = 'TenantContextMissingError';
  }
}

const baseClient = new PrismaClient();

/**
 * Prisma singleton extended with per-query RLS injection.
 *
 * Every query is wrapped in an interactive transaction that:
 * 1. Issues `SET LOCAL app.current_tenant_id = '<uuid>'`
 * 2. Runs the original operation
 *
 * SET LOCAL is transaction-scoped, so the value is cleared after each
 * query and cannot leak across pooled connections.
 *
 * IMPORTANT: baseClient.$transaction is used so the SET LOCAL and the
 * query share the same connection. Do NOT use $executeRawUnsafe standalone.
 */
export const db = baseClient.$extends({
  query: {
    $allModels: {
      // `model` and `operation` are the camelCase Prisma client accessor names,
      // e.g. model='toolCall', operation='findMany'.
      // We intentionally do NOT use `query(args)` here because that callback is
      // bound to baseClient's connection pool and would execute on a *different*
      // connection than the SET LOCAL issued on `tx` — causing the RLS variable
      // to be silently missing for the actual query (C-3 fix).
      //
      // Instead we re-issue the operation directly on `tx` (the transaction client),
      // which guarantees SET LOCAL and the query share the same connection.
      // `tx` is the raw PrismaClient (no extensions) so this does NOT recurse.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async $allOperations({ model, operation, args, query: _query }) {
        const tenantId = getTenantId();

        if (!tenantId) {
          throw new TenantContextMissingError();
        }

        if (!UUID_RE.test(tenantId)) {
          throw new Error(`Invalid tenantId format: ${tenantId}`);
        }

        return baseClient.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
          // Run through tx so SET LOCAL and query share the same DB connection.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (tx as any)[model][operation](args) as Promise<unknown>;
        });
      },
    },
  },
});

export type Db = typeof db;

/**
 * Raw PrismaClient (no RLS extension).
 * Used by the cost tracker, which handles tenant scoping via WHERE clauses
 * and should not trigger nested transactions from the RLS extension.
 */
export { baseClient as prisma };
