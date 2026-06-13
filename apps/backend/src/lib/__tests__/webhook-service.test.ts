/**
 * Unit tests for the webhook delivery service: signing, dispatch fan-out/filtering,
 * failure recording, and the in-process retry schedule (fake timers).
 */
import { createHmac } from 'crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks (declared before importing the service) ----

vi.mock('../db.js', () => ({
  prisma: {
    webhook: { findMany: vi.fn() },
    webhookDelivery: {
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('../logger.js', () => ({
  default: {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock('../url-safety.js', () => ({
  assertPublicWebhookUrl: vi.fn().mockResolvedValue(undefined),
  UnsafeWebhookUrlError: class UnsafeWebhookUrlError extends Error {},
}));

import { prisma } from '../db.js';
import { assertPublicWebhookUrl } from '../url-safety.js';
import {
  buildSignatureHeader,
  dispatch,
  generateWebhookSecret,
  signPayload,
} from '../webhook-service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindMany = (prisma.webhook as any).findMany as ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreate   = (prisma.webhookDelivery as any).create as ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUpdate   = (prisma.webhookDelivery as any).update as ReturnType<typeof vi.fn>;
const mockAssertUrl = assertPublicWebhookUrl as ReturnType<typeof vi.fn>;

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function okResponse(status = 200) {
  return { status, text: () => Promise.resolve('ok') };
}
function errResponse(status = 500) {
  return { status, text: () => Promise.resolve('boom') };
}

// ===========================================================================
describe('signing', () => {
  it('signPayload produces a valid HMAC-SHA256 over `${ts}.${payload}`', () => {
    const secret = 'whsec_test';
    const payload = '{"hello":"world"}';
    const ts = 1_700_000_000;

    const expected = createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex');
    expect(signPayload(secret, payload, ts)).toBe(expected);
  });

  it('buildSignatureHeader formats the X-Progue-Signature value as t=,v1=', () => {
    const header = buildSignatureHeader('whsec_test', '{}', 123);
    expect(header).toMatch(/^t=123,v1=[a-f0-9]{64}$/);
  });

  it('generateWebhookSecret returns 64 hex chars (32 bytes)', () => {
    const secret = generateWebhookSecret();
    expect(secret).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ===========================================================================
describe('dispatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset().mockResolvedValue(okResponse(200));
    mockFindMany.mockReset();
    mockCreate.mockReset().mockResolvedValue({});
    mockUpdate.mockReset().mockResolvedValue({});
    mockAssertUrl.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('queries only active webhooks subscribed to the event (skips inactive + unsubscribed)', async () => {
    mockFindMany.mockResolvedValue([]);

    await dispatch('tenant-1', 'approval.approved', { approvalId: 'a1' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_id: 'tenant-1', is_active: true, events: { has: 'approval.approved' } },
      }),
    );
  });

  it('sends to every active webhook subscribed to the event', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'w1', url: 'https://a.example/hook', secret: 's1' },
      { id: 'w2', url: 'https://b.example/hook', secret: 's2' },
    ]);

    await dispatch('tenant-1', 'decision.halted', { rule: 'r' });
    await vi.advanceTimersByTimeAsync(0);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://a.example/hook');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://b.example/hook');
  });

  it('attaches a valid X-Progue-Signature header to the POST', async () => {
    mockFindMany.mockResolvedValue([{ id: 'w1', url: 'https://a.example/hook', secret: 's1' }]);

    await dispatch('tenant-1', 'approval.approved', {});
    await vi.advanceTimersByTimeAsync(0);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const header = (init.headers as Record<string, string>)['X-Progue-Signature'];
    expect(header).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('records success:false with the status code on a 500 response', async () => {
    mockFindMany.mockResolvedValue([{ id: 'w1', url: 'https://a.example/hook', secret: 's1' }]);
    fetchMock.mockResolvedValue(errResponse(500));

    await dispatch('tenant-1', 'approval.approved', {});
    await vi.advanceTimersByTimeAsync(0);

    const last = mockUpdate.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };
    expect(last.data['success']).toBe(false);
    expect(last.data['status_code']).toBe(500);
  });

  it('schedules a second attempt ~5s after the first failure', async () => {
    mockFindMany.mockResolvedValue([{ id: 'w1', url: 'https://a.example/hook', secret: 's1' }]);
    fetchMock.mockResolvedValue(errResponse(500));

    await dispatch('tenant-1', 'approval.approved', {});
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops after 4 attempts (5s → 60s → 300s) and marks the delivery permanently failed', async () => {
    mockFindMany.mockResolvedValue([{ id: 'w1', url: 'https://a.example/hook', secret: 's1' }]);
    fetchMock.mockResolvedValue(errResponse(503));

    await dispatch('tenant-1', 'approval.approved', {});
    await vi.advanceTimersByTimeAsync(0);       // attempt 1
    await vi.advanceTimersByTimeAsync(5_000);   // attempt 2
    await vi.advanceTimersByTimeAsync(60_000);  // attempt 3
    await vi.advanceTimersByTimeAsync(300_000); // attempt 4
    await vi.advanceTimersByTimeAsync(600_000); // no further retries

    expect(fetchMock).toHaveBeenCalledTimes(4);

    const last = mockUpdate.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };
    expect(last.data['attempt_count']).toBe(4);
    expect(last.data['next_retry_at']).toBeNull();
  });

  it('blocks delivery to an unsafe (SSRF) url without fetching, with no retry', async () => {
    mockFindMany.mockResolvedValue([{ id: 'w1', url: 'https://169.254.169.254/hook', secret: 's1' }]);
    mockAssertUrl.mockRejectedValue(new Error('url resolves to a non-public address'));

    await dispatch('tenant-1', 'approval.approved', {});
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).not.toHaveBeenCalled();
    const last = mockUpdate.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };
    expect(last.data['success']).toBe(false);
    expect(last.data['next_retry_at']).toBeNull();

    // No retry scheduled for a blocked url.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks the delivery delivered on a 2xx response', async () => {
    mockFindMany.mockResolvedValue([{ id: 'w1', url: 'https://a.example/hook', secret: 's1' }]);
    fetchMock.mockResolvedValue(okResponse(204));

    await dispatch('tenant-1', 'approval.approved', {});
    await vi.advanceTimersByTimeAsync(0);

    const last = mockUpdate.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };
    expect(last.data['success']).toBe(true);
    expect(last.data['status_code']).toBe(204);
    expect(last.data['delivered_at']).toBeInstanceOf(Date);
  });
});
