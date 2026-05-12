// Augment Express Locals with multi-tenant context set by auth middleware.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Express } from 'express';

declare global {
  namespace Express {
    interface Locals {
      /** Clerk org_id — used as the tenant's primary key in our DB. */
      tenantId?: string;
      /** Clerk user sub claim. */
      userId?: string;
    }
  }
}
