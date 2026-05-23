import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

import { apiFetch } from '../lib/api';
import type { ApiKey } from '../types/dashboard';

const cellStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize:   '11.5px',
  color:      'var(--text-2)',
  padding:    '12px 18px',
};

export default function ApiKeys() {
  const { getToken }              = useAuth();
  const [keys, setKeys]           = useState<ApiKey[]>([]);
  const [newName, setNewName]     = useState('');
  const [newKey, setNewKey]       = useState<string | null>(null);
  const [creating, setCreating]   = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await apiFetch<{ keys: ApiKey[] }>('/api/keys', token);
    setKeys(res.keys);
  }, [getToken]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    setNewKey(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiFetch<{ key: ApiKey }>('/api/keys', token, {
        method: 'POST',
        body:   JSON.stringify({ name: newName.trim() }),
      });
      setNewKey(res.key.raw ?? null);
      setNewName('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    await apiFetch(`/api/keys/${id}`, token, { method: 'DELETE' });
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, letterSpacing: '-0.02em' }}>API Keys</h1>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
        Keys authenticate your product&apos;s requests to the Progue API.
      </p>

      {/* New key one-time banner */}
      {newKey && (
        <div style={{
          marginBottom: '20px',
          padding:      '14px 18px',
          background:   'var(--surface)',
          border:       '1px solid var(--border)',
          borderLeft:   '3px solid var(--success)',
          borderRadius: '0 8px 8px 0',
        }}>
          <p style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500, marginBottom: '8px' }}>
            Copy this key now — it will not be shown again.
          </p>
          <code style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text)', wordBreak: 'break-all' }}>
            {newKey}
          </code>
          <button
            onClick={() => { void navigator.clipboard.writeText(newKey); setNewKey(null); }}
            style={{
              display:        'block',
              marginTop:      '8px',
              fontSize:       '11px',
              color:          'var(--success)',
              background:     'none',
              border:         'none',
              cursor:         'pointer',
              fontFamily:     'var(--mono)',
              textDecoration: 'underline',
            }}
          >
            Copy &amp; dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void create(); }}
          placeholder="Key name (e.g. Production)"
          style={{
            flex:         1,
            background:   'var(--surface)',
            border:       '1px solid var(--border-strong)',
            borderRadius: '8px',
            padding:      '8px 12px',
            fontSize:     '13px',
            color:        'var(--text)',
            fontFamily:   'var(--sans)',
            outline:      'none',
          }}
        />
        <button
          onClick={() => void create()}
          disabled={creating || !newName.trim()}
          style={{
            padding:      '8px 16px',
            background:   'var(--brand)',
            border:       'none',
            borderRadius: '8px',
            fontSize:     '13px',
            fontWeight:   500,
            color:        '#fff',
            cursor:       'pointer',
            opacity:      (creating || !newName.trim()) ? 0.4 : 1,
            fontFamily:   'var(--sans)',
          }}
        >
          {creating ? 'Creating…' : 'Create Key'}
        </button>
      </div>

      {error && (
        <p style={{ color: 'var(--error)', fontSize: '12px', marginBottom: '12px' }}>
          Error: {error}
        </p>
      )}

      {/* Keys table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display:             'grid',
          gridTemplateColumns: '1fr 140px 120px 120px 80px',
          padding:             '11px 18px',
          fontFamily:          'var(--mono)',
          fontSize:            '10px',
          letterSpacing:       '0.04em',
          textTransform:       'uppercase',
          color:               'var(--text-3)',
          borderBottom:        '1px solid var(--border)',
        }}>
          <span>Name</span>
          <span>Prefix</span>
          <span>Created</span>
          <span>Last Used</span>
          <span />
        </div>

        {keys.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
            No API keys yet
          </div>
        ) : (
          keys.map((k) => (
            <div
              key={k.id}
              style={{
                display:             'grid',
                gridTemplateColumns: '1fr 140px 120px 120px 80px',
                borderBottom:        '1px solid var(--border)',
                transition:          'background 0.12s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-raised)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              <span style={{ ...cellStyle, color: 'var(--text)', fontSize: '13px' }}>{k.name}</span>
              <span style={cellStyle}>{k.prefix}…</span>
              <span style={cellStyle}>{new Date(k.createdAt).toLocaleDateString()}</span>
              <span style={cellStyle}>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</span>
              <span style={{ ...cellStyle, display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => void revoke(k.id)}
                  style={{
                    background:     'none',
                    border:         'none',
                    cursor:         'pointer',
                    color:          'var(--error)',
                    fontSize:       '11px',
                    fontFamily:     'var(--mono)',
                    textDecoration: 'underline',
                  }}
                >
                  Revoke
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
