import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
  userId?: string;
}

/**
 * Singleton AsyncLocalStorage that carries the active tenant context
 * across async boundaries without param drilling.
 *
 * NOTE: tenantId is the Clerk org_id stored directly as tenants.id.
 * If we later decouple Clerk IDs from our primary keys, add a lookup
 * cache here and replace getStore() callers.
 */
export const tenantContext = new AsyncLocalStorage<TenantContext>();

/** Retrieve tenantId from current async context, or undefined. */
export function getTenantId(): string | undefined {
  return tenantContext.getStore()?.tenantId;
}

/** Run fn within a tenant context. */
export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return tenantContext.run(ctx, fn);
}
