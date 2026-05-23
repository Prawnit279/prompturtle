import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

import { apiFetch } from '../lib/api';
import type { UsageResponse } from '../types/dashboard';

interface StatCardProps { label: string; value: string }

function StatCard({ label, value }: StatCardProps) {
  return (
    <div
      style={{
        background:   'var(--surface)',
        border:       '1px solid var(--border)',
        borderRadius: '10px',
        padding:      '18px 20px',
      }}
    >
      <p style={{
        fontFamily:    'var(--mono)',
        fontSize:      '10px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color:         'var(--text-3)',
        marginBottom:  '8px',
      }}>
        {label}
      </p>
      <p style={{ fontSize: '24px', fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.02em' }}>
        {value}
      </p>
    </div>
  );
}

export default function Overview() {
  const { getToken }                  = useAuth();
  const [usage, setUsage]             = useState<UsageResponse | null>(null);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    getToken()
      .then((token) => {
        if (!token) return;
        apiFetch<UsageResponse>('/api/usage?days=30', token)
          .then(setUsage)
          .catch((e: Error) => setError(e.message));
      })
      .catch(() => { /* noop — user not signed in */ });
  }, [getToken]);

  if (error) return <p style={{ color: 'var(--error)', fontSize: '13px' }}>Error: {error}</p>;
  if (!usage) return <p style={{ color: 'var(--text-2)', fontSize: '13px' }}>Loading…</p>;

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, letterSpacing: '-0.02em' }}>Overview</h1>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)' }}>
          Last 30 days
        </span>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '24px' }}>
        Usage summary for all MCP servers connected to Progue.
      </p>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '32px' }}>
        <StatCard label="Total Calls"     value={usage.totalCalls.toLocaleString()} />
        <StatCard label="Total Cost"      value={`$${usage.totalCostUsd.toFixed(4)}`} />
        <StatCard label="Active Servers"  value={usage.byServer.length.toString()} />
      </div>

      {/* By-server table */}
      <h2 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>Usage by MCP Server</h2>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: '1fr 80px 100px 100px 100px',
          padding:             '11px 18px',
          fontFamily:          'var(--mono)',
          fontSize:            '10px',
          letterSpacing:       '0.04em',
          textTransform:       'uppercase',
          color:               'var(--text-3)',
          borderBottom:        '1px solid var(--border)',
        }}>
          <span>Server</span>
          <span style={{ textAlign: 'right' }}>Calls</span>
          <span style={{ textAlign: 'right' }}>Tokens In</span>
          <span style={{ textAlign: 'right' }}>Tokens Out</span>
          <span style={{ textAlign: 'right' }}>Cost (USD)</span>
        </div>

        {/* Rows */}
        {usage.byServer.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
            No calls in the last 30 days
          </div>
        ) : (
          usage.byServer.map((row) => (
            <div
              key={row.server}
              style={{
                display:             'grid',
                gridTemplateColumns: '1fr 80px 100px 100px 100px',
                padding:             '12px 18px',
                fontFamily:          'var(--mono)',
                fontSize:            '11.5px',
                color:               'var(--text-2)',
                borderBottom:        '1px solid var(--border)',
                transition:          'background 0.12s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-raised)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              <span style={{ color: 'var(--text)' }}>{row.server}</span>
              <span style={{ textAlign: 'right' }}>{row.calls.toLocaleString()}</span>
              <span style={{ textAlign: 'right' }}>{row.inputTokens.toLocaleString()}</span>
              <span style={{ textAlign: 'right' }}>{row.outputTokens.toLocaleString()}</span>
              <span style={{ textAlign: 'right' }}>${row.costUsd.toFixed(4)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
