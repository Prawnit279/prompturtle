import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

import { apiFetch } from '../lib/api';
import { PLANS, type StripeEnvKey } from '../content/plans';

interface BillingStatus {
  tier:               'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  isFreeTier:         boolean;
  priceUsd:           number;
  subscriptionStatus: string;
  stripeCustomerId:   string | null;
  stripePriceId:      string | null;
  callsThisMonth:     number;
  callLimit:          number;
}

// Stripe price ids per paid tier — the only billing-specific bit the dashboard
// adds on top of the shared PLANS source of truth.
const STRIPE_PRICE_ENV: Record<StripeEnvKey, string | undefined> = {
  STARTER:    import.meta.env.VITE_STRIPE_PRICE_STARTER    as string | undefined,
  GROWTH:     import.meta.env.VITE_STRIPE_PRICE_GROWTH     as string | undefined,
  ENTERPRISE: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE as string | undefined,
};

export default function Billing() {
  const { getToken }               = useAuth();
  const [status, setStatus]        = useState<BillingStatus | null>(null);
  const [loading, setLoading]      = useState(true);
  const [error, setError]          = useState<string | null>(null);
  const [actionLoading, setAction] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;
      const data = await apiFetch<BillingStatus>('/api/billing/status', token);
      setStatus(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { void load(); }, [load]);

  const handleUpgrade = async (priceId: string | undefined) => {
    if (!priceId) { setError('Price not configured — contact support.'); return; }
    try {
      setAction(true);
      setError(null);
      const token = await getToken();
      if (!token) return;
      const res = await apiFetch<{ url: string }>('/api/billing/checkout', token, {
        method: 'POST',
        body:   JSON.stringify({ priceId }),
      });
      if (res.url) window.location.href = res.url;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAction(false);
    }
  };

  const handlePortal = async () => {
    try {
      setAction(true);
      setError(null);
      const token = await getToken();
      if (!token) return;
      const res = await apiFetch<{ url: string }>('/api/billing/portal', token, { method: 'POST' });
      if (res.url) window.location.href = res.url;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAction(false);
    }
  };

  const usagePct = status
    ? Math.min(100, Math.round((status.callsThisMonth / status.callLimit) * 100))
    : 0;
  const barColor = usagePct >= 100 ? 'var(--error)' : usagePct >= 80 ? 'var(--warning)' : 'var(--brand)';
  const limitReached = usagePct >= 100;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, letterSpacing: '-0.02em' }}>Billing</h1>
        {status?.stripeCustomerId && (
          <button
            onClick={() => void handlePortal()}
            disabled={actionLoading}
            style={{
              padding: '6px 14px', background: 'var(--surface-raised)',
              border: '1px solid var(--border-strong)', borderRadius: '8px',
              fontSize: '12px', color: 'var(--text)', cursor: 'pointer',
              fontFamily: 'var(--sans)', opacity: actionLoading ? 0.5 : 1,
            }}
          >
            Manage Subscription
          </button>
        )}
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '24px' }}>
        Current plan and usage for this billing period.
      </p>

      {error && (
        <p style={{ color: 'var(--error)', fontSize: '12px', marginBottom: '16px' }}>
          Error: {error}
        </p>
      )}

      {/* Usage summary card */}
      {loading ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '24px', marginBottom: '24px',
          color: 'var(--text-3)', fontSize: '13px',
        }}>Loading…</div>
      ) : status && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '20px 24px', marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
            <div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Current plan
              </span>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', marginTop: '2px' }}>
                {status.tier.charAt(0) + status.tier.slice(1).toLowerCase()}
              </div>
              {status.isFreeTier && (
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px', fontFamily: 'var(--mono)' }}>
                  {status.callLimit.toLocaleString()} calls/month · No expiry · No credit card
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Status
              </span>
              <div style={{
                marginTop: '2px', fontSize: '12px', fontFamily: 'var(--mono)',
                color: status.subscriptionStatus === 'active' ? 'var(--success)' : 'var(--text-2)',
              }}>
                {status.subscriptionStatus}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px' }}>
            {status.callsThisMonth.toLocaleString()} / {status.callLimit.toLocaleString()} calls this month
          </div>
          <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${usagePct}%`,
              background: barColor,
              borderRadius: '2px', transition: 'width 0.3s',
            }} />
          </div>
          {limitReached && (
            <div style={{ fontSize: '12px', color: 'var(--error)', marginTop: '8px' }}>
              Limit reached — API calls are paused until you upgrade.
            </div>
          )}
        </div>
      )}

      {/* Plan cards — same four plans, numbers, and features as the marketing
          pricing page (single source: content/plans.ts). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', alignItems: 'stretch' }}>
        {PLANS.map((plan) => {
          const isCurrent  = status?.tier === plan.tier;
          const priceId    = plan.stripeEnvKey ? STRIPE_PRICE_ENV[plan.stripeEnvKey] : undefined;
          const canUpgrade = !isCurrent && Boolean(plan.stripeEnvKey);
          return (
            <div
              key={plan.tier}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${isCurrent || plan.recommended ? 'var(--brand)' : 'var(--border)'}`,
                borderRadius: '10px', padding: '20px', position: 'relative',
                display: 'flex', flexDirection: 'column',
              }}
            >
              {(isCurrent || plan.recommended) && (
                <div style={{
                  position: 'absolute', top: '12px', right: '12px',
                  fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--brand)',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>
                  {isCurrent ? 'Current' : 'Recommended'}
                </div>
              )}
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                {plan.name}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '2px' }}>
                ${plan.priceUsd}
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-2)' }}>/mo</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', fontFamily: 'var(--mono)' }}>
                {plan.calls}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--mono)', marginBottom: '14px' }}>
                {plan.rateLimit}
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '12px', color: 'var(--text-2)' }}>
                    <span style={{ marginTop: '5px', width: '5px', height: '5px', borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => { if (canUpgrade) void handleUpgrade(priceId); }}
                disabled={!canUpgrade || actionLoading}
                style={{
                  width: '100%', padding: '8px',
                  background: canUpgrade ? 'var(--brand)' : 'transparent',
                  border: canUpgrade ? 'none' : '1px solid var(--border)',
                  borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                  color: canUpgrade ? '#fff' : 'var(--text-2)',
                  cursor: canUpgrade ? 'pointer' : 'default',
                  opacity: actionLoading && canUpgrade ? 0.5 : 1,
                  fontFamily: 'var(--sans)',
                }}
              >
                {isCurrent ? 'Current plan' : canUpgrade ? `Upgrade to ${plan.name}` : 'Free plan'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Invoice history — paid tiers only */}
      {status?.isFreeTier && (
        <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '24px' }}>
          Invoices appear here once you upgrade to a paid plan.
        </p>
      )}
    </div>
  );
}
