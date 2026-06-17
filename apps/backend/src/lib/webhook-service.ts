/**
 * Webhook delivery service (Week 3).
 *
 * - dispatch(): fan-out an event to every active webhook subscribed to it.
 * - HMAC-SHA256 signing, Stripe-style: header `t=<unix>,v1=<hex sig>`.
 * - In-process retry with exponential backoff (no queue/Redis). Attempt 1 is
 *   immediate; failures reschedule via setTimeout. 4 attempts total, then the
 *   delivery is marked permanently failed.
 *
 * Delivery is fire-and-forget from the caller's perspective: dispatch() resolves
 * once delivery records are created and first attempts are kicked off; retries
 * continue in the background.
 */
import { createHmac, randomBytes, randomUUID } from 'crypto';

import type { InputJsonValue } from '@prisma/client/runtime/library';
import type { WebhookEventType, WebhookPayload } from '@prompturtle/shared';

import { prisma } from './db.js';
import logger from './logger.js';
import { assertPublicWebhookUrl } from './url-safety.js';

/** Per-attempt HTTP timeout. */
const DELIVERY_TIMEOUT_MS = 10_000;

/**
 * Backoff before attempts 2, 3 and 4 respectively (ms). Index `attempt - 1`
 * gives the delay scheduled after that attempt fails.
 */
const RETRY_DELAYS_MS = [5_000, 60_000, 300_000] as const;

/** Total attempts before a delivery is abandoned. */
const MAX_ATTEMPTS = 4;

/** Cap stored response bodies so a chatty endpoint can't bloat the log. */
const MAX_RESPONSE_BODY = 1_000;

/** Minimal shape needed to sign and POST a delivery. */
interface DeliveryTarget {
  id: string;
  url: string;
  secret: string;
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

/** Generate a fresh HMAC signing secret (returned once at registration). */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

/** HMAC-SHA256 over `${timestamp}.${payload}`, hex-encoded. */
export function signPayload(secret: string, payload: string, timestamp: number): string {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
}

/** Build the `X-Progue-Signature: t=<ts>,v1=<sig>` header value. */
export function buildSignatureHeader(secret: string, payload: string, timestamp: number): string {
  return `t=${timestamp},v1=${signPayload(secret, payload, timestamp)}`;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Fan-out `event` to every active webhook for `tenantId` subscribed to it.
 * Never throws — a webhook failure must not break the caller's request path.
 */
export async function dispatch(
  tenantId: string,
  event: WebhookEventType,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { tenant_id: tenantId, is_active: true, events: { has: event } },
      select: { id: true, url: true, secret: true },
    });

    for (const webhook of webhooks) {
      const payload = buildPayload(tenantId, event, data);
      await prisma.webhookDelivery.create({
        data: {
          id:            payload.id,
          webhook_id:    webhook.id,
          event,
          payload:       payload as unknown as InputJsonValue,
          success:       false,
          attempt_count: 1,
        },
      });
      // Fire-and-forget: kick the first attempt, retries self-schedule.
      void attemptDelivery(webhook, payload, 1, { scheduleRetries: true });
    }
  } catch (err) {
    logger.error({ err, tenantId, event }, 'webhook.dispatch.failed');
  }
}

/**
 * Send a single synthetic `test.ping` to one webhook and await the first
 * attempt so the caller (the test route) can report the outcome. Does not
 * schedule retries — a test ping should be one-shot.
 */
export async function sendTestPing(webhook: DeliveryTarget, tenantId: string): Promise<{
  success: boolean;
  statusCode: number | null;
}> {
  const payload = buildPayload(tenantId, 'test.ping', {
    message: 'This is a test ping from Progue. If you can verify this signature, your endpoint is ready.',
  });

  await prisma.webhookDelivery.create({
    data: {
      id:            payload.id,
      webhook_id:    webhook.id,
      event:         'test.ping',
      payload:       payload as unknown as InputJsonValue,
      success:       false,
      attempt_count: 1,
    },
  });

  return attemptDelivery(webhook, payload, 1, { scheduleRetries: false });
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function buildPayload(
  tenantId: string,
  event: WebhookEventType,
  data: Record<string, unknown>,
): WebhookPayload {
  return {
    id:        randomUUID(),
    event,
    createdAt: new Date().toISOString(),
    tenantId,
    data,
  };
}

interface AttemptOptions {
  scheduleRetries: boolean;
}

async function attemptDelivery(
  webhook: DeliveryTarget,
  payload: WebhookPayload,
  attempt: number,
  opts: AttemptOptions,
): Promise<{ success: boolean; statusCode: number | null }> {
  // SSRF guard — re-checked at delivery time so a hostname repointed at an
  // internal IP after registration is still blocked. A blocked URL is a
  // terminal failure: retrying won't help and could be abused.
  try {
    await assertPublicWebhookUrl(webhook.url);
  } catch (err) {
    await prisma.webhookDelivery.update({
      where: { id: payload.id },
      data: {
        success:       false,
        status_code:   null,
        response_body: err instanceof Error ? err.message : 'blocked: unsafe url',
        attempt_count: attempt,
        next_retry_at: null,
      },
    });
    logger.warn(
      { webhookId: webhook.id, deliveryId: payload.id, url: webhook.url },
      'webhook.delivery.blocked_unsafe_url',
    );
    return { success: false, statusCode: null };
  }

  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = buildSignatureHeader(webhook.secret, body, timestamp);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const res = await fetch(webhook.url, {
      method:  'POST',
      headers: {
        'Content-Type':       'application/json',
        'X-Progue-Signature': signature,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const responseBody = await res.text().catch(() => '');
    const success = res.status >= 200 && res.status < 300;

    if (success) {
      await prisma.webhookDelivery.update({
        where: { id: payload.id },
        data: {
          success:       true,
          status_code:   res.status,
          response_body: responseBody.slice(0, MAX_RESPONSE_BODY),
          attempt_count: attempt,
          delivered_at:  new Date(),
          next_retry_at: null,
        },
      });
      logger.info(
        { webhookId: webhook.id, deliveryId: payload.id, attempt, status: res.status },
        'webhook.delivered',
      );
      return { success: true, statusCode: res.status };
    }

    await recordFailure(webhook, payload, attempt, res.status, responseBody, opts);
    return { success: false, statusCode: res.status };
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : 'delivery_error';
    await recordFailure(webhook, payload, attempt, null, message, opts);
    return { success: false, statusCode: null };
  }
}

async function recordFailure(
  webhook: DeliveryTarget,
  payload: WebhookPayload,
  attempt: number,
  statusCode: number | null,
  responseBody: string,
  opts: AttemptOptions,
): Promise<void> {
  const isLastAttempt = attempt >= MAX_ATTEMPTS;
  const willRetry = opts.scheduleRetries && !isLastAttempt;
  const nextDelay = RETRY_DELAYS_MS[attempt - 1];
  const nextRetryAt = willRetry && nextDelay !== undefined
    ? new Date(Date.now() + nextDelay)
    : null;

  await prisma.webhookDelivery.update({
    where: { id: payload.id },
    data: {
      success:       false,
      status_code:   statusCode,
      response_body: responseBody.slice(0, MAX_RESPONSE_BODY),
      attempt_count: attempt,
      next_retry_at: nextRetryAt,
    },
  });

  logger.warn(
    { webhookId: webhook.id, deliveryId: payload.id, attempt, statusCode },
    willRetry ? 'webhook.delivery.retry_scheduled' : 'webhook.delivery.permanently_failed',
  );

  if (willRetry && nextDelay !== undefined) {
    setTimeout(() => {
      void attemptDelivery(webhook, payload, attempt + 1, opts);
    }, nextDelay);
  }
}
