import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

import { apiFetch } from '../lib/api';

interface BillingStatus {
  tier:               'STARTER' | 'GROWTH' | 'ENTERPRISE';
  subscriptionStatus: string;
  stripeCustomerId:   string | null;
  stripePriceId:      string | null;
  callsThisMonth:     number;
  callLimit:          number;
}

const TIERS = [
  {
    key:      'STARTER'    as const,
    label:    'Starter',
    price:    '$149',
    calls:    '1,000',
    priceEnv: import.meta.env.VITE_STRIPE_PRICE_STARTER as string | undefined,
  },
  {
    key:      'GROWTH'     as const,
    label:    'Growth',
    price:    '$599',
    calls:    '10,000',
    priceEnv: import.meta.env.VITE_STRIPE_PRICE_GROWTH as string | undefined,
  },
  {
    key:      'ENTERPRISE' as const,
    label:    'Enterprise',
    price:    '$1,999',
    calls:    '100,000',
    priceEnv: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE as string | undefined,
  },
] as const;

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
              background: usagePct > 80 ? 'var(--warning)' : 'var(--brand)',
              borderRadius: '2px', transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* Tier cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {TIERS.map((tier) => {
          const isCurrent = status?.tier === tier.key;
          return (
            <div
              key={tier.key}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${isCurrent ? 'var(--brand)' : 'var(--border)'}`,
                borderRadius: '10px', padding: '20px', position: 'relative',
              }}
            >
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: '12px', right: '12px',
                  fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--brand)',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>
                  Current
                </div>
              )}
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                {tier.label}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '2px' }}>
                {tier.price}
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-2)' }}>/mo</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '16px', fontFamily: 'var(--mono)' }}>
                {tier.calls} calls/month
              </div>
              <button
                onClick={() => void handleUpgrade(tier.priceEnv)}
                disabled={isCurrent || actionLoading}
                style={{
                  width: '100%', padding: '8px',
                  background: isCurrent ? 'transparent' : 'var(--brand)',
                  border: isCurrent ? '1px solid var(--border)' : 'none',
                  borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                  color: isCurrent ? 'var(--text-2)' : '#fff',
                  cursor: isCurrent ? 'default' : 'pointer',
                  opacity: actionLoading && !isCurrent ? 0.5 : 1,
                  fontFamily: 'var(--sans)',
                }}
              >
                {isCurrent ? 'Current plan' : `Upgrade to ${tier.label}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
