// vi.mock is hoisted by Vitest — safe to declare after imports.
import type { NextFunction, Request, Response } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/clerk-sdk-node', () => ({
  createClerkClient: vi.fn(() => ({
    verifyToken: vi.fn(),
  })),
}));

// Import after vi.mock so the hoisted mock is in place
import { auth } from '../auth';

function makeRes() {
  const locals: Record<string, unknown> = {};
  return {
    locals,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function makeReq(authHeader?: string): Request {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as Request;
}

const next = vi.fn() as unknown as NextFunction;

describe('auth middleware', () => {
  // Capture verifyToken once — createClerkClient is called during auth.ts import.
  // vi.clearAllMocks() wipes mock.results, so we must grab the ref before beforeEach.
  let verifyToken: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    const { createClerkClient } = await import('@clerk/clerk-sdk-node');
    verifyToken = (createClerkClient as any).mock.results[0].value.verifyToken as ReturnType<
      typeof vi.fn
    >;
  });

  beforeEach(() => {
    // clearAllMocks resets call history on all mocks (including next).
    // verifyToken reference remains valid — clearAllMocks wipes history, not the fn object.
    vi.clearAllMocks();
  });

  it('passes through without setting locals when no Authorization header', async () => {
    const req = makeReq();
    const res = makeRes();
    await auth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.tenantId).toBeUndefined();
    expect(res.locals.userId).toBeUndefined();
  });

  it('passes through without setting locals when header is not Bearer', async () => {
    const req = makeReq('Basic abc123');
    const res = makeRes();
    await auth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.tenantId).toBeUndefined();
  });

  it('sets tenantId and userId on valid token with org_id', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_abc', org_id: 'org_xyz' });
    const req = makeReq('Bearer valid.token.here');
    const res = makeRes();
    await auth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.tenantId).toBe('org_xyz');
    expect(res.locals.userId).toBe('user_abc');
  });

  it('sets userId but not tenantId on valid token without org_id', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_abc' });
    const req = makeReq('Bearer valid.token.here');
    const res = makeRes();
    await auth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.userId).toBe('user_abc');
    expect(res.locals.tenantId).toBeUndefined();
  });

  it('returns 401 on invalid or expired token', async () => {
    verifyToken.mockRejectedValue(new Error('token expired'));
    const req = makeReq('Bearer bad.token');
    const res = makeRes();
    await auth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid_token' });
  });
});
