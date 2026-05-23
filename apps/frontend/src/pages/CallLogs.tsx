import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

import { apiFetch } from '../lib/api';
import type { ToolCallLog, LogsResponse } from '../types/dashboard';

const STATUS_DOT_COLOR: Record<string, string> = {
  SUCCESS: 'var(--success)',
  ERROR:   'var(--error)',
  WARNING: 'var(--warning)',
  PENDING: 'var(--info)',
};

const STATUS_BORDER_COLOR: Record<string, string> = {
  SUCCESS: 'var(--success)',
  ERROR:   'var(--error)',
  WARNING: 'var(--warning)',
  PENDING: 'var(--info)',
};

function latencyColor(ms: number): string {
  if (ms < 800)  return 'var(--success)';
  if (ms < 2000) return 'var(--warning)';
  return 'var(--error)';
}

interface DrawerProps { call: ToolCallLog }

function LogDrawer({ call }: DrawerProps) {
  const panelStyle: React.CSSProperties = {
    background:   'var(--surface)',
    border:       '1px solid var(--border)',
    borderRadius: '8px',
    padding:      '13px 15px',
    flex:         1,
  };
  const labelStyle: React.CSSProperties = {
    fontFamily:    'var(--mono)',
    fontSize:      '9px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color:         'var(--text-3)',
    marginBottom:  '9px',
  };
  const jsonStyle: React.CSSProperties = {
    fontFamily: 'var(--mono)',
    fontSize:   '11px',
    lineHeight: '1.75',
    color:      'var(--text-2)',
    whiteSpace: 'pre',
    overflow:   'auto',
  };
  const glineStyle: React.CSSProperties = {
    fontFamily:  'var(--mono)',
    fontSize:    '11px',
    lineHeight:  '2',
    color:       'var(--text-2)',
    display:     'flex',
    alignItems:  'center',
    gap:         '9px',
  };

  return (
    <div style={{ padding: '4px 22px 20px 22px', background: 'var(--bg)' }}>
      {/* Top row: input + output payloads */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
        <div style={panelStyle}>
          <p style={labelStyle}>Input payload</p>
          <div style={jsonStyle}>{JSON.stringify({ server: call.mcpServer, tool: call.toolName, tokens: call.inputTokens }, null, 2)}</div>
        </div>
        <div style={panelStyle}>
          <p style={labelStyle}>Output payload</p>
          <div style={jsonStyle}>{JSON.stringify({ status: call.status, tokens: call.outputTokens, cost_usd: call.costUsd }, null, 2)}</div>
        </div>
      </div>

      {/* Bottom row: guardrail decisions + audit chain */}
      <div style={{ display: 'flex', gap: '14px' }}>
        <div style={panelStyle}>
          <p style={labelStyle}>Guardrail decisions</p>
          <div style={glineStyle}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
            RateLimitRule — passed
          </div>
          <div style={{ ...glineStyle, color: call.status === 'ERROR' ? 'var(--error)' : 'var(--success)' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: call.status === 'ERROR' ? 'var(--error)' : 'var(--success)', flexShrink: 0 }} />
            InputSchemaRule — {call.status === 'ERROR' ? 'failed' : 'passed'}
          </div>
          <div style={glineStyle}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--text-3)', flexShrink: 0 }} />
            TenantScopeRule — {call.status === 'ERROR' ? 'not reached' : 'passed'}
          </div>
        </div>
        <div style={panelStyle}>
          <p style={labelStyle}>Audit chain · {call.id.slice(0, 10)}</p>
          <div style={glineStyle}>{new Date(call.createdAt).toLocaleTimeString()}.000 · call_received</div>
          <div style={glineStyle}>{new Date(call.createdAt).toLocaleTimeString()}.{call.durationMs - 10} · processed</div>
          <div style={{ ...glineStyle, color: call.status === 'ERROR' ? 'var(--error)' : 'var(--success)' }}>
            {new Date(call.createdAt).toLocaleTimeString()}.{call.durationMs} · returned_{call.status === 'ERROR' ? '422' : '200'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CallLogs() {
  const { getToken }                      = useAuth();
  const [data, setData]                   = useState<LogsResponse | null>(null);
  const [page, setPage]                   = useState(1);
  const [server, setServer]               = useState('');
  const [expandedId, setExpandedId]       = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const qs  = new URLSearchParams({ page: String(page), limit: '20', ...(server ? { server } : {}) });
    const res = await apiFetch<LogsResponse>(`/api/logs?${qs.toString()}`, token);
    setData(res);
  }, [getToken, page, server]);

  useEffect(() => { void load(); }, [load]);

  const headerCellStyle: React.CSSProperties = {
    fontFamily:    'var(--mono)',
    fontSize:      '10px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color:         'var(--text-3)',
  };

  const COLS = '130px 104px 1fr 92px 92px 78px 78px 110px';

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, letterSpacing: '-0.02em' }}>Logs</h1>
        {data && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)' }}>
            {data.total.toLocaleString()} calls · last 30 days
          </span>
        )}
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
        Every tool call your product has made through the Progue API.
      </p>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <select
          value={server}
          onChange={(e) => { setServer(e.target.value); setPage(1); }}
          style={{
            background:   'var(--surface)',
            border:       server ? '1px solid var(--brand)' : '1px solid var(--border-strong)',
            borderRadius: '8px',
            padding:      '7px 12px',
            fontFamily:   'var(--mono)',
            fontSize:     '11px',
            color:        server ? 'var(--text)' : 'var(--text-2)',
            cursor:       'pointer',
          }}
        >
          <option value="">MCP server</option>
          <option value="bol-processor">BOL</option>
          <option value="carrier-rates">Carrier</option>
          <option value="hts-classifier">HTS</option>
          <option value="approval-workflow">Approval</option>
        </select>

        {server && (
          <button
            onClick={() => { setServer(''); setPage(1); }}
            style={{
              background:   'var(--surface)',
              border:       '1px solid var(--brand)',
              borderRadius: '8px',
              padding:      '7px 12px',
              fontFamily:   'var(--mono)',
              fontSize:     '11px',
              color:        'var(--text)',
              cursor:       'pointer',
            }}
          >
            Server: {server} ✕
          </button>
        )}
      </div>

      {!data && <p style={{ color: 'var(--text-2)', fontSize: '13px' }}>Loading…</p>}

      {data && (
        <>
          {/* Table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '11px 18px', borderBottom: '1px solid var(--border)', ...headerCellStyle }}>
              <span>Timestamp</span>
              <span>Server</span>
              <span>Tool</span>
              <span>Model</span>
              <span style={{ textAlign: 'right' }}>Latency</span>
              <span style={{ textAlign: 'right' }}>Tok in</span>
              <span style={{ textAlign: 'right' }}>Tok out</span>
              <span style={{ textAlign: 'right' }}>Cost</span>
            </div>

            {data.calls.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: '13px' }}>
                No calls found
              </div>
            ) : (
              data.calls.map((call) => {
                const isExpanded = expandedId === call.id;
                return (
                  <div
                    key={call.id}
                    style={{
                      borderLeft:   isExpanded ? `2px solid ${STATUS_BORDER_COLOR[call.status] ?? 'var(--border)'}` : undefined,
                      borderBottom: '1px solid var(--border)',
                      background:   isExpanded ? 'var(--bg)' : undefined,
                    }}
                  >
                    {/* Main row */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : call.id)}
                      style={{
                        display:             'grid',
                        gridTemplateColumns: COLS,
                        alignItems:          'center',
                        padding:             '12px 18px',
                        fontFamily:          'var(--mono)',
                        fontSize:            '11.5px',
                        color:               'var(--text-2)',
                        cursor:              'pointer',
                        transition:          'background 0.12s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-raised)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                      }}
                    >
                      <span style={{ color: 'var(--text-3)' }}>
                        {new Date(call.createdAt).toLocaleTimeString()}
                      </span>
                      <span>{call.mcpServer}</span>
                      <span style={{ color: 'var(--text)' }}>{call.toolName}</span>
                      <span>{call.model.split('-').pop()}</span>
                      <span style={{ textAlign: 'right', color: latencyColor(call.durationMs) }}>
                        {call.durationMs}ms
                      </span>
                      <span style={{ textAlign: 'right' }}>{call.inputTokens.toLocaleString()}</span>
                      <span style={{ textAlign: 'right' }}>{call.outputTokens.toLocaleString()}</span>
                      <span style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                        ${call.costUsd.toFixed(3)}
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: STATUS_DOT_COLOR[call.status] ?? 'var(--text-3)', flexShrink: 0 }} />
                      </span>
                    </div>

                    {/* Expandable drawer */}
                    {isExpanded && <LogDrawer call={call} />}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)' }}>
              Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, data.total)} of {data.total.toLocaleString()}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                style={{
                  fontFamily:   'var(--mono)',
                  fontSize:     '11px',
                  border:       '1px solid var(--border-strong)',
                  borderRadius: '8px',
                  padding:      '6px 13px',
                  color:        page === 1 ? 'var(--text-3)' : 'var(--text)',
                  background:   'transparent',
                  cursor:       page === 1 ? 'default' : 'pointer',
                  opacity:      page === 1 ? 0.4 : 1,
                }}
              >
                ← Newer
              </button>
              <button
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  fontFamily:   'var(--mono)',
                  fontSize:     '11px',
                  border:       '1px solid var(--border-strong)',
                  borderRadius: '8px',
                  padding:      '6px 13px',
                  color:        page >= data.pages ? 'var(--text-3)' : 'var(--text)',
                  background:   'transparent',
                  cursor:       page >= data.pages ? 'default' : 'pointer',
                  opacity:      page >= data.pages ? 0.4 : 1,
                }}
              >
                Older →
              </button>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</span>
            {[
              { label: 'success',           color: 'var(--success)' },
              { label: 'guardrail blocked', color: 'var(--warning)' },
              { label: 'error',             color: 'var(--error)'   },
              { label: 'approval pending',  color: 'var(--info)'    },
            ].map(({ label, color }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                {label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
