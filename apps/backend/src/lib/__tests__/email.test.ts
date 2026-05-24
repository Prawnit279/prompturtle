/**
 * Unit tests for lib/email.ts and integration tests for /api/webhooks/clerk.
 * Resend and svix are fully mocked — no real API calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// ---- Mocks ----

// Mock Resend — must be before email.ts is imported
const mockSend = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

// Mock svix — controls Clerk webhook signature verification
const mockVerify = vi.fn();
vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: mockVerify,
  })),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock('../cost-tracker.js', () => ({
  trackedCall: vi.fn().mockImplementation((_o: unknown, fn: () => unknown) => fn()),
  TierLimitExceededError: class TierLimitExceededError extends Error {},
}));

vi.mock('../logger.js', () => ({
  default: {
    info:  vi.fn(),
    error: vi.fn(),
    warn:  vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

vi.mock('../../guardrails/GuardrailEngine.js', () => ({
  guardrailEngine: { enforce: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../guardrails/rules/InputSchemaRule.js', () => ({
  InputSchemaRule:    class InputSchemaRule { check = vi.fn().mockResolvedValue(null); },
  registerToolSchema: vi.fn(),
}));

vi.mock('../../data/hts-ingest.js', () => ({
  searchHtsCodes: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../lib/stripe.js', () => ({
  stripe: {
    webhooks:      { constructEvent: vi.fn() },
    customers:     { create: vi.fn() },
    checkout:      { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
  },
}));

vi.mock('@clerk/clerk-sdk-node', () => ({
  createClerkClient: vi.fn(() => ({
    verifyToken: vi.fn().mockImplementation((token: string) => {
      if (token === 'test-token-starter') {
        return Promise.resolve({ sub: 'user-test', org_id: 'tenant-test' });
      }
      return Promise.reject(new Error('Invalid token'));
    }),
  })),
}));

vi.mock('../../lib/db.js', () => ({
  prisma: {
    processedWebhook: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    tenant:   { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue({}) },
    apiKey:   { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    toolCall: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
  },
  db: {},
}));

// Set RESEND_API_KEY so getResend() returns a client
process.env.RESEND_API_KEY = 'test_resend_key';
process.env.CLERK_WEBHOOK_SECRET = 'test_clerk_secret';

// Import after mocks
import { sendWelcomeEmail, sendBillingConfirmationEmail, sendUsageWarningEmail } from '../email.js';
import app from '../../app.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ data: { id: 'email_test_123' }, error: null });
  mockVerify.mockReturnValue({
    type: 'user.created',
    data: {
      email_addresses: [{ email_address: 'user@example.com' }],
      first_name: 'Ada',
      last_name:  'Lovelace',
    },
  });
});

// ===========================================================================
describe('sendWelcomeEmail', () => {
  it('calls resend.emails.send with correct to/subject', async () => {
    await sendWelcomeEmail({ to: 'a@b.com', tenantName: 'Acme', apiKey: 'ptk_test' });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to:      'a@b.com',
        subject: expect.stringContaining('Welcome'),
      }),
    );
  });

  it('returns { success: true, id } on success', async () => {
    const result = await sendWelcomeEmail({ to: 'a@b.com', tenantName: 'Acme', apiKey: 'ptk_test' });
    expect(result.success).toBe(true);
    expect(result.id).toBe('email_test_123');
  });

  it('returns { success: false, error } when Resend returns error', async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: 'Invalid email' } });
    const result = await sendWelcomeEmail({ to: 'bad', tenantName: 'Acme', apiKey: 'ptk_test' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid email');
  });
});

// ===========================================================================
describe('sendBillingConfirmationEmail', () => {
  it('formats unlimited call limit correctly', async () => {
    await sendBillingConfirmationEmail({ to: 'a@b.com', tenantName: 'Acme', tier: 'ENTERPRISE', callLimit: -1 });
    const callArgs = mockSend.mock.calls[0]?.[0] as { html: string };
    expect(callArgs.html).toContain('Unlimited');
  });

  it('formats numeric call limit with locale separators', async () => {
    await sendBillingConfirmationEmail({ to: 'a@b.com', tenantName: 'Acme', tier: 'GROWTH', callLimit: 10000 });
    const callArgs = mockSend.mock.calls[0]?.[0] as { html: string };
    expect(callArgs.html).toContain('10,000');
  });
});

// ===========================================================================
describe('sendUsageWarningEmail', () => {
  it('sends when percentUsed >= 80', async () => {
    const result = await sendUsageWarningEmail({
      to: 'a@b.com', tenantName: 'Acme', tier: 'STARTER',
      callsUsed: 820, callLimit: 1000, percentUsed: 82,
    });
    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('82%') }),
    );
  });
});

// ===========================================================================
describe('POST /api/webhooks/clerk', () => {
  it('returns 400 when svix headers are missing', async () => {
    const res = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .send('{}');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/svix/i);
  });

  it('returns 400 when signature verification fails', async () => {
    mockVerify.mockImplementationOnce(() => { throw new Error('bad signature'); });
    const res = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .set('svix-id', 'msg_1')
      .set('svix-timestamp', '1234567890')
      .set('svix-signature', 'bad')
      .send('{}');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/signature/i);
  });

  it('returns 200 and sends welcome email on user.created', async () => {
    const res = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .set('svix-id', 'msg_1')
      .set('svix-timestamp', '1234567890')
      .set('svix-signature', 'v1,valid')
      .send('{}');

    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com' }),
    );
  });

  it('returns 200 on organization.created even if no email present', async () => {
    mockVerify.mockReturnValueOnce({
      type: 'organization.created',
      data: { name: 'Acme Corp', created_by: 'user_abc' },
    });
    const res = await request(app)
      .post('/api/webhooks/clerk')
      .set('Content-Type', 'application/json')
      .set('svix-id', 'msg_2')
      .set('svix-timestamp', '1234567890')
      .set('svix-signature', 'v1,valid')
      .send('{}');

    expect(res.status).toBe(200);
    // No email sent — org events don't have a reliable email field
    expect(mockSend).not.toHaveBeenCalled();
  });
});
