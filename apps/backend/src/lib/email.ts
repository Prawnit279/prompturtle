/**
 * Transactional email via Resend.
 * All email functions are non-fatal — callers must handle { success: false }.
 * The Resend client is lazily initialised so a missing key doesn't crash the server;
 * send() returns an error result instead.
 */
import { Resend } from 'resend';

import logger from './logger.js';

const FROM_ADDRESS = 'Progue.ai <no-reply@progue.ai>';

export interface SendResult {
  success: boolean;
  id?: string;
  error?: string;
}

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('email.send_skipped: RESEND_API_KEY not configured');
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

async function send(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const client = getResend();
  if (!client) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const { data, error } = await client.emails.send({
      from:    FROM_ADDRESS,
      to:      opts.to,
      subject: opts.subject,
      html:    opts.html,
    });

    if (error) {
      logger.error({ error, to: opts.to, subject: opts.subject }, 'email.send_failed');
      return { success: false, error: error.message };
    }

    logger.info({ id: data?.id, to: opts.to, subject: opts.subject }, 'email.sent');
    return { success: true, id: data?.id };
  } catch (err) {
    logger.error({ err, to: opts.to }, 'email.send_threw');
    return { success: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(opts: {
  to: string;
  tenantName: string;
  apiKey: string;
}): Promise<SendResult> {
  return send({
    to:      opts.to,
    subject: 'Welcome to Progue.ai — your API key is ready',
    html: `
      <div style="font-family: 'Geist', system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #060B1A; color: #E2E8F0; padding: 40px;">
        <h1 style="color: #5B3A82; margin-bottom: 8px;">Welcome to Progue<span style="color: #5B3A82;">.</span></h1>
        <p style="color: #94A3B8; margin-bottom: 32px;">Your API key is live. Here&apos;s everything you need to get started.</p>

        <div style="background: #0F172A; border: 1px solid #1E293B; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <p style="color: #94A3B8; font-size: 12px; margin: 0 0 8px;">API KEY</p>
          <code style="color: #5B3A82; font-family: 'Geist Mono', monospace; font-size: 14px;">${opts.apiKey}</code>
          <p style="color: #475569; font-size: 11px; margin: 12px 0 0;">This key is shown once. Store it securely.</p>
        </div>

        <p style="color: #94A3B8;">You&apos;re on the <strong style="color: #E2E8F0;">Starter plan</strong> — 1,000 API calls/month.</p>

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #1E293B;">
          <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #5B3A82; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px;">Open Dashboard &rarr;</a>
        </div>

        <p style="color: #475569; font-size: 12px; margin-top: 32px;">Progue.ai &middot; Supply Chain Context Engineering</p>
      </div>
    `,
  });
}

export async function sendBillingConfirmationEmail(opts: {
  to: string;
  tenantName: string;
  tier: string;
  callLimit: number | string;
}): Promise<SendResult> {
  const limitDisplay =
    opts.callLimit === -1 || opts.callLimit === 'unlimited'
      ? 'Unlimited'
      : `${Number(opts.callLimit).toLocaleString()}/month`;

  return send({
    to:      opts.to,
    subject: `Progue.ai — ${opts.tier} plan activated`,
    html: `
      <div style="font-family: 'Geist', system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #060B1A; color: #E2E8F0; padding: 40px;">
        <h1 style="color: #5B3A82;">Subscription confirmed<span style="color: #5B3A82;">.</span></h1>
        <p style="color: #94A3B8;">Your <strong style="color: #E2E8F0;">${opts.tier}</strong> plan is now active.</p>

        <div style="background: #0F172A; border: 1px solid #1E293B; border-radius: 8px; padding: 24px; margin: 24px 0;">
          <p style="margin: 0 0 4px; color: #94A3B8; font-size: 12px;">PLAN</p>
          <p style="margin: 0; font-size: 18px; font-weight: 600;">${opts.tier}</p>
          <p style="margin: 8px 0 0; color: #94A3B8; font-size: 14px;">API calls: ${limitDisplay}</p>
        </div>

        <a href="${process.env.FRONTEND_URL}/dashboard/billing" style="background: #5B3A82; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px;">Manage Billing &rarr;</a>

        <p style="color: #475569; font-size: 12px; margin-top: 32px;">Progue.ai &middot; Supply Chain Context Engineering</p>
      </div>
    `,
  });
}

export async function sendUsageWarningEmail(opts: {
  to: string;
  tenantName: string;
  tier: string;
  callsUsed: number;
  callLimit: number;
  percentUsed: number;
}): Promise<SendResult> {
  return send({
    to:      opts.to,
    subject: `Progue.ai — you've used ${opts.percentUsed}% of your monthly API calls`,
    html: `
      <div style="font-family: 'Geist', system-ui, sans-serif; max-width: 600px; margin: 0 auto; background: #060B1A; color: #E2E8F0; padding: 40px;">
        <h1 style="color: #D97706;">Usage alert<span style="color: #D97706;">.</span></h1>
        <p style="color: #94A3B8;">You&apos;ve used <strong style="color: #E2E8F0;">${opts.percentUsed}%</strong> of your monthly API calls.</p>

        <div style="background: #0F172A; border: 1px solid #1E293B; border-radius: 8px; padding: 24px; margin: 24px 0;">
          <p style="margin: 0 0 4px; color: #94A3B8; font-size: 12px;">USAGE</p>
          <p style="margin: 0; font-size: 24px; font-weight: 600;">${opts.callsUsed.toLocaleString()} <span style="color: #475569; font-size: 14px;">/ ${opts.callLimit.toLocaleString()}</span></p>

          <div style="margin-top: 12px; background: #1E293B; border-radius: 4px; height: 8px; overflow: hidden;">
            <div style="background: #D97706; height: 100%; width: ${opts.percentUsed}%;"></div>
          </div>
        </div>

        <p style="color: #94A3B8;">Upgrade to avoid disruption when your limit is reached.</p>

        <a href="${process.env.FRONTEND_URL}/dashboard/billing" style="background: #5B3A82; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px;">Upgrade Plan &rarr;</a>

        <p style="color: #475569; font-size: 12px; margin-top: 32px;">Progue.ai &middot; Supply Chain Context Engineering</p>
      </div>
    `,
  });
}
