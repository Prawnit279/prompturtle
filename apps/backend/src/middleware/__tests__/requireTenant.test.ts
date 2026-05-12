import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { requireTenant } from '../requireTenant';

function makeRes(tenantId?: string) {
  return {
    locals: { tenantId },
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

const req = {} as Request;
const next = vi.fn() as unknown as NextFunction;

describe('requireTenant middleware', () => {
  it('calls next() when tenantId is present', () => {
    vi.clearAllMocks();
    const res = makeRes('org_abc');
    requireTenant(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when tenantId is absent', () => {
    vi.clearAllMocks();
    const res = makeRes(undefined);
    requireTenant(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'tenant_required' });
  });

  it('returns 401 when tenantId is empty string', () => {
    vi.clearAllMocks();
    const res = makeRes('');
    requireTenant(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
