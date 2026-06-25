import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

import { apiFetch } from '../lib/api';

interface BillingStatusLite {
  isFreeTier:     boolean;
  callsThisMonth: number;
  callLimit:      number;
}

/**
 * Persistent (non-dismissable) banner shown on every dashboard page for FREE
 * tier tenants. Blue normally → amber at ≥80% usage → red at ≥100%. Renders
 * nothing for paid tiers (or before billing status loads).
 */
export default function FreeTierBanner() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<BillingStatusLite | null>(null);

  useEffect(() => {
    getToken()
      .then((token) => {
        if (!token) return;
        apiFetch<BillingStatusLite>('/api/billing/status', token).then(setStatus).catch(() => { /* noop */ });
      })
      .catch(() => { /* not signed in */ });
  }, [getToken]);

  if (!status?.isFreeTier) return null;

  const pct      = Math.min(100, Math.round((status.callsThisMonth / status.callLimit) * 100));
  const reached  = pct >= 100;
  const warning  = pct >= 80;
  const accent   = reached ? 'var(--error)' : warning ? 'var(--warning)' : 'var(--info)';
  const bg       = reached
    ? 'rgba(195,107,122,0.12)'
    : warning
      ? 'rgba(201,168,106,0.12)'
      : 'rgba(62,111,160,0.12)';

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      gap:            '12px',
      padding:        '9px 24px',
      background:     bg,
      borderBottom:   `1px solid ${accent}`,
      fontSize:       '13px',
      color:          'var(--text-2)',
      flexShrink:     0,
    }}>
      <span>
        <strong style={{ color: accent }}>{reached ? 'Limit reached' : 'Free tier'}</strong>
        {' · '}
        {reached
          ? 'API calls are paused until you upgrade.'
          : `${status.callsThisMonth.toLocaleString()} of ${status.callLimit.toLocaleString()} calls used`}
      </span>
      <Link
        to="/dashboard/billing"
        style={{ color: accent, fontWeight: 500, textDecoration: 'none', whiteSpace: 'nowrap' }}
      >
        Upgrade your plan →
      </Link>
    </div>
  );
}
