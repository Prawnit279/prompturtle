import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

import { apiFetch } from '../lib/api';
import {
  WEBHOOK_EVENTS,
  type Webhook,
  type WebhookDeliveriesResponse,
  type WebhookEventType,
} from '../types/dashboard';

// ---------------------------------------------------------------------------
// Shared style atoms (match the dashboard's CallLogs / ApiKeys pattern)
// ---------------------------------------------------------------------------

const monoLabel: React.CSSProperties = {
  fontFamily:    'var(--mono)',
  fontSize:      '10px',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color:         'var(--text-3)',
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
      background: ok ? 'var(--success)' : 'var(--text-3)',
    }} />
  );
}

function EventChip({ label }: { label: string }) {
  return (
    <span style={{
      fontFamily:   'var(--mono)',
      fontSize:     '10.5px',
      color:        'var(--text-2)',
      background:   'var(--bg)',
      border:       '1px solid var(--border-strong)',
      borderRadius: '6px',
      padding:      '2px 7px',
      whiteSpace:   'nowrap',
    }}>
      {label}
    </span>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// ===========================================================================
// Delivery drawer — opens inline below an endpoint row
// ===========================================================================

interface DrawerProps { webhookId: string }

function DeliveryDrawer({ webhookId }: DrawerProps) {
  const { getToken } = useAuth();
  const [data, setData]   = useState<WebhookDeliveriesResponse | null>(null);
  const [page, setPage]   = useState(1);
  const [pinging, setPinging] = useState(false);
  const [pingMsg, setPingMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await apiFetch<WebhookDeliveriesResponse>(
      `/api/webhooks/${webhookId}/deliveries?page=${page}`, token,
    );
    setData(res);
  }, [getToken, webhookId, page]);

  useEffect(() => { void load(); }, [load]);

  const sendPing = async () => {
    setPinging(true);
    setPingMsg(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiFetch<{ success: boolean; statusCode: number | null }>(
        `/api/webhooks/${webhookId}/test`, token, { method: 'POST' },
      );
      setPingMsg(res.success ? `Test ping delivered (${res.statusCode})` : `Test ping failed (${res.statusCode ?? 'no response'})`);
      setPage(1);
      await load();
    } catch (e) {
      setPingMsg((e as Error).message);
    } finally {
      setPinging(false);
    }
  };

  const COLS = '150px 1fr 90px 78px 70px';

  return (
    <div style={{ padding: '8px 22px 20px 22px', background: 'var(--bg)' }}>
      {/* Drawer header — test ping */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={monoLabel}>Delivery log</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {pingMsg && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)' }}>{pingMsg}</span>
          )}
          <button
            onClick={() => void sendPing()}
            disabled={pinging}
            style={{
              fontFamily: 'var(--mono)', fontSize: '11px',
              border: '1px solid var(--border-strong)', borderRadius: '8px',
              padding: '6px 12px', background: 'transparent',
              color: 'var(--text)', cursor: pinging ? 'default' : 'pointer', opacity: pinging ? 0.5 : 1,
            }}
          >
            {pinging ? 'Sending…' : 'Send test ping'}
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, padding: '9px 14px', borderBottom: '1px solid var(--border)', ...monoLabel }}>
          <span>Timestamp</span>
          <span>Event</span>
          <span style={{ textAlign: 'right' }}>Status</span>
          <span style={{ textAlign: 'right' }}>Success</span>
          <span style={{ textAlign: 'right' }}>Attempts</span>
        </div>

        {!data && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px' }}>Loading…</div>}

        {data && data.deliveries.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px' }}>
            No deliveries yet. Send a test ping to verify your endpoint.
          </div>
        )}

        {data?.deliveries.map((d) => (
          <div key={d.id} style={{
            display: 'grid', gridTemplateColumns: COLS, alignItems: 'center',
            padding: '10px 14px', borderBottom: '1px solid var(--border)',
            fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)',
          }}>
            <span style={{ color: 'var(--text-3)' }}>{new Date(d.createdAt).toLocaleString()}</span>
            <span style={{ color: 'var(--text)' }}>{d.event}</span>
            <span style={{ textAlign: 'right' }}>{d.statusCode ?? '—'}</span>
            <span style={{ display: 'flex', justifyContent: 'flex-end' }}><StatusDot ok={d.success} /></span>
            <span style={{ textAlign: 'right' }}>{d.attemptCount}</span>
          </div>
        ))}
      </div>

      {data && data.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
            style={pagerStyle(page === 1)}>← Newer</button>
          <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}
            style={pagerStyle(page >= data.pages)}>Older →</button>
        </div>
      )}
    </div>
  );
}

function pagerStyle(disabled: boolean): React.CSSProperties {
  return {
    fontFamily: 'var(--mono)', fontSize: '11px',
    border: '1px solid var(--border-strong)', borderRadius: '8px',
    padding: '5px 11px', background: 'transparent',
    color: disabled ? 'var(--text-3)' : 'var(--text)',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
  };
}

// ===========================================================================
// Add / edit endpoint modal
// ===========================================================================

interface ModalProps {
  initial?: Webhook;
  onClose: () => void;
  onSaved: (secret?: string) => void;
}

function EndpointModal({ initial, onClose, onSaved }: ModalProps) {
  const { getToken } = useAuth();
  const isEdit = Boolean(initial);
  const [url, setUrl]                 = useState(initial?.url ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [events, setEvents]           = useState<WebhookEventType[]>(initial?.events ?? []);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const isValidUrl = /^https:\/\/.+/.test(url.trim());
  const canSave = isValidUrl && events.length > 0 && !saving;

  const toggleEvent = (ev: WebhookEventType) => {
    setEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const body: Record<string, unknown> = { url: url.trim(), events };
      if (description.trim()) body['description'] = description.trim();

      if (isEdit && initial) {
        await apiFetch(`/api/webhooks/${initial.id}`, token, { method: 'PATCH', body: JSON.stringify(body) });
        onSaved();
      } else {
        const res = await apiFetch<{ webhook: Webhook }>('/api/webhooks', token, {
          method: 'POST', body: JSON.stringify(body),
        });
        onSaved(res.webhook.secret);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(3,6,16,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '480px', maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto',
        background: 'var(--surface)', border: '1px solid var(--border-strong)',
        borderRadius: '12px', padding: '24px',
      }}>
        <h2 style={{ fontSize: '17px', fontWeight: 500, letterSpacing: '-0.01em', marginBottom: '18px' }}>
          {isEdit ? 'Edit endpoint' : 'Add endpoint'}
        </h2>

        {/* URL */}
        <label style={{ ...monoLabel, display: 'block', marginBottom: '6px' }}>Endpoint URL</label>
        <input
          type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-app.com/webhooks/progue"
          style={inputStyle(url.length > 0 && !isValidUrl)}
        />
        {url.length > 0 && !isValidUrl && (
          <p style={{ color: 'var(--error)', fontSize: '11px', marginTop: '5px' }}>Must be an https:// URL.</p>
        )}

        {/* Description */}
        <label style={{ ...monoLabel, display: 'block', margin: '16px 0 6px' }}>Description (optional)</label>
        <input
          type="text" value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Production order service"
          style={inputStyle(false)}
        />

        {/* Events */}
        <label style={{ ...monoLabel, display: 'block', margin: '16px 0 8px' }}>Subscribed events</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {WEBHOOK_EVENTS.map((ev) => {
            const checked = events.includes(ev);
            return (
              <button key={ev} onClick={() => toggleEvent(ev)} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
              }}>
                <span style={{
                  width: '15px', height: '15px', borderRadius: '4px', flexShrink: 0,
                  border: checked ? '1px solid var(--brand)' : '1px solid var(--border-strong)',
                  background: checked ? 'var(--brand)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '10px', lineHeight: 1,
                }}>{checked ? '✓' : ''}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: checked ? 'var(--text)' : 'var(--text-2)' }}>{ev}</span>
              </button>
            );
          })}
        </div>

        {error && <p style={{ color: 'var(--error)', fontSize: '12px', marginTop: '14px' }}>Error: {error}</p>}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-strong)',
            borderRadius: '8px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'var(--sans)',
          }}>Cancel</button>
          <button onClick={() => void save()} disabled={!canSave} style={{
            padding: '8px 16px', background: 'var(--brand)', border: 'none', borderRadius: '8px',
            fontSize: '13px', fontWeight: 500, color: '#fff', fontFamily: 'var(--sans)',
            cursor: canSave ? 'pointer' : 'default', opacity: canSave ? 1 : 0.4,
          }}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create endpoint'}</button>
        </div>
      </div>
    </div>
  );
}

function inputStyle(invalid: boolean): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg)', borderRadius: '8px', padding: '9px 12px',
    border: invalid ? '1px solid var(--error)' : '1px solid var(--border-strong)',
    fontSize: '13px', color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none',
  };
}

// ===========================================================================
// Page
// ===========================================================================

export default function Webhooks() {
  const { getToken } = useAuth();
  const [webhooks, setWebhooks] = useState<Webhook[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Webhook | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await apiFetch<{ webhooks: Webhook[] }>('/api/webhooks', token);
    setWebhooks(res.webhooks);
  }, [getToken]);

  useEffect(() => { void load(); }, [load]);

  const deactivate = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    await apiFetch(`/api/webhooks/${id}`, token, { method: 'DELETE' });
    await load();
  };

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (w: Webhook) => { setEditing(w); setModalOpen(true); };

  const handleSaved = (secret?: string) => {
    setModalOpen(false);
    setEditing(null);
    if (secret) setNewSecret(secret);
    void load();
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, letterSpacing: '-0.02em' }}>Webhooks</h1>
        <button onClick={openAdd} style={{
          padding: '8px 16px', background: 'var(--brand)', border: 'none', borderRadius: '8px',
          fontSize: '13px', fontWeight: 500, color: '#fff', cursor: 'pointer', fontFamily: 'var(--sans)',
        }}>Add endpoint</button>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
        Receive real-time delivery events when approvals resolve, guardrails halt, or usage crosses a threshold.
      </p>

      {/* One-time secret banner */}
      {newSecret && (
        <div style={{
          marginBottom: '20px', padding: '14px 18px', background: 'var(--surface)',
          border: '1px solid var(--border)', borderLeft: '3px solid var(--success)', borderRadius: '0 8px 8px 0',
        }}>
          <p style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500, marginBottom: '8px' }}>
            Copy this signing secret now — we won&apos;t show it again.
          </p>
          <code style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text)', wordBreak: 'break-all' }}>{newSecret}</code>
          <button onClick={() => { void navigator.clipboard.writeText(newSecret); setNewSecret(null); }} style={{
            display: 'block', marginTop: '8px', fontSize: '11px', color: 'var(--success)',
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', textDecoration: 'underline',
          }}>Copy &amp; dismiss</button>
        </div>
      )}

      {!webhooks && <p style={{ color: 'var(--text-2)', fontSize: '13px' }}>Loading…</p>}

      {/* Empty state */}
      {webhooks && webhooks.length === 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
          padding: '44px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '6px' }}>No webhooks yet.</p>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '18px' }}>
            Add an endpoint to receive real-time delivery events.
          </p>
          <button onClick={openAdd} style={{
            padding: '8px 16px', background: 'var(--brand)', border: 'none', borderRadius: '8px',
            fontSize: '13px', fontWeight: 500, color: '#fff', cursor: 'pointer', fontFamily: 'var(--sans)',
          }}>Add endpoint</button>
        </div>
      )}

      {/* Endpoint list */}
      {webhooks && webhooks.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          {webhooks.map((w) => {
            const isExpanded = expandedId === w.id;
            return (
              <div key={w.id} style={{ borderBottom: '1px solid var(--border)', background: isExpanded ? 'var(--bg)' : undefined }}>
                <div style={{ padding: '14px 18px' }}>
                  {/* Row 1: url + status + created */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '9px' }}>
                    <StatusDot ok={w.isActive} />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '12.5px', color: 'var(--text)' }}>{truncate(w.url, 60)}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '10.5px', color: w.isActive ? 'var(--success)' : 'var(--text-3)' }}>
                      {w.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-3)' }}>
                      Created {new Date(w.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Row 2: event chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '11px' }}>
                    {w.events.map((ev) => <EventChip key={ev} label={ev} />)}
                  </div>

                  {/* Row 3: last delivery + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text-2)' }}>
                      {w.lastDelivery ? (
                        <>
                          <StatusDot ok={w.lastDelivery.success} />
                          Last delivery {new Date(w.lastDelivery.createdAt).toLocaleString()}
                          {w.lastDelivery.statusCode != null && ` · ${w.lastDelivery.statusCode}`}
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-3)' }}>No deliveries yet</span>
                      )}
                    </span>

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '14px' }}>
                      <button onClick={() => openEdit(w)} style={actionBtn('var(--text-2)')}>Edit</button>
                      {w.isActive && (
                        <button onClick={() => void deactivate(w.id)} style={actionBtn('var(--error)')}>Deactivate</button>
                      )}
                      <button onClick={() => setExpandedId(isExpanded ? null : w.id)} style={actionBtn('var(--text)')}>
                        {isExpanded ? 'Hide deliveries' : 'View deliveries'}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && <DeliveryDrawer webhookId={w.id} />}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <EndpointModal
          {...(editing ? { initial: editing } : {})}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function actionBtn(color: string): React.CSSProperties {
  return {
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    color, fontSize: '11px', fontFamily: 'var(--mono)', textDecoration: 'underline',
  };
}
