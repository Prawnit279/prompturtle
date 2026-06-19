import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

import { apiFetch } from '../lib/api';
import type { GuardrailConfig } from '../types/dashboard';

// ---------------------------------------------------------------------------
// Style atoms (match the dashboard's inline-style + CSS-token convention)
// ---------------------------------------------------------------------------

const fieldLabel: React.CSSProperties = {
  fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '4px', display: 'block',
};
const helperText: React.CSSProperties = {
  fontSize: '12px', color: 'var(--text-3)', marginTop: '6px', lineHeight: 1.5,
};
const cardStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
  padding: '18px 20px', marginBottom: '14px',
};

function numberInput(invalid: boolean): React.CSSProperties {
  return {
    width: '220px', boxSizing: 'border-box', background: 'var(--bg)',
    border: invalid ? '1px solid var(--error)' : '1px solid var(--border-strong)',
    borderRadius: '8px', padding: '8px 12px', fontSize: '13px',
    color: 'var(--text)', fontFamily: 'var(--mono)', outline: 'none',
  };
}

// ===========================================================================
// Carrier chip input
// ===========================================================================

interface CarrierInputProps {
  carriers: string[];
  onChange: (next: string[]) => void;
}

function CarrierInput({ carriers, onChange }: CarrierInputProps) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!carriers.some((c) => c.toLowerCase() === v.toLowerCase())) onChange([...carriers, v]);
    setDraft('');
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: carriers.length ? '8px' : 0 }}>
        {carriers.map((c) => (
          <span key={c} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontFamily: 'var(--mono)', fontSize: '11.5px', color: 'var(--text)',
            background: 'var(--bg)', border: '1px solid var(--border-strong)',
            borderRadius: '6px', padding: '3px 8px',
          }}>
            {c}
            <button
              onClick={() => onChange(carriers.filter((x) => x !== c))}
              aria-label={`Remove ${c}`}
              style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 0, fontSize: '13px', lineHeight: 1 }}
            >×</button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder="Type a carrier or SCAC code, press Enter"
        style={{
          width: '320px', maxWidth: '100%', boxSizing: 'border-box', background: 'var(--bg)',
          border: '1px solid var(--border-strong)', borderRadius: '8px', padding: '8px 12px',
          fontSize: '13px', color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none',
        }}
      />
    </div>
  );
}

// ===========================================================================
// Page
// ===========================================================================

const DEFAULTS: GuardrailConfig = {
  id: '', tenantId: '', costThreshold: 10000, approvedCarriers: [],
  requireBrokerVerify: true, autoApproveBelow: 0, updatedAt: '', isDefault: true,
};

export default function Guardrails() {
  const { getToken } = useAuth();
  const [loaded, setLoaded]   = useState(false);
  const [isDefault, setIsDefault] = useState(true);

  const [costThreshold, setCostThreshold]       = useState(10000);
  const [autoApproveBelow, setAutoApproveBelow] = useState(0);
  const [approvedCarriers, setApprovedCarriers] = useState<string[]>([]);
  const [requireBrokerVerify, setRequireBrokerVerify] = useState(true);

  const [saving, setSaving]       = useState(false);
  const [banner, setBanner]       = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const apply = useCallback((c: GuardrailConfig) => {
    setCostThreshold(c.costThreshold);
    setAutoApproveBelow(c.autoApproveBelow);
    setApprovedCarriers(c.approvedCarriers);
    setRequireBrokerVerify(c.requireBrokerVerify);
    setIsDefault(Boolean(c.isDefault));
  }, []);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await apiFetch<GuardrailConfig>('/api/guardrails/config', token);
    apply(res);
    setLoaded(true);
  }, [getToken, apply]);

  useEffect(() => { void load(); }, [load]);

  // ---- Validation (mirrors the server) ----
  const costError = costThreshold <= 0 ? 'Must be greater than 0.' : null;
  const autoError = autoApproveBelow < 0
    ? 'Cannot be negative.'
    : autoApproveBelow >= costThreshold
      ? 'Must be less than the cost approval threshold.'
      : null;
  const canSave = !costError && !autoError && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setBanner(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiFetch<GuardrailConfig>('/api/guardrails/config', token, {
        method: 'PATCH',
        body: JSON.stringify({ costThreshold, autoApproveBelow, approvedCarriers, requireBrokerVerify }),
      });
      apply(res);
      setBanner({ kind: 'success', msg: 'Guardrail configuration saved.' });
    } catch (e) {
      setBanner({ kind: 'error', msg: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setConfirmReset(false);
    setSaving(true);
    setBanner(null);
    try {
      const token = await getToken();
      if (!token) return;
      await apiFetch('/api/guardrails/config', token, { method: 'DELETE' });
      apply(DEFAULTS);
      setBanner({ kind: 'success', msg: 'Reset to platform defaults.' });
    } catch (e) {
      setBanner({ kind: 'error', msg: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '720px' }}>
      {/* Header */}
      <h1 style={{ fontSize: '22px', fontWeight: 500, letterSpacing: '-0.02em', marginBottom: '6px' }}>
        Guardrail Configuration
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
        Customize when guardrails fire for your tenants. Changes take effect immediately.
      </p>

      {/* Banners */}
      {isDefault && loaded && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', background: 'var(--surface)',
          border: '1px solid var(--border)', borderLeft: '3px solid var(--info)', borderRadius: '0 8px 8px 0',
          fontSize: '13px', color: 'var(--text-2)',
        }}>
          Using platform defaults. Customize below to match your business needs.
        </div>
      )}
      {banner && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${banner.kind === 'success' ? 'var(--success)' : 'var(--error)'}`,
          borderRadius: '0 8px 8px 0', fontSize: '13px',
          color: banner.kind === 'success' ? 'var(--success)' : 'var(--error)',
        }}>
          {banner.msg}
        </div>
      )}

      {!loaded && <p style={{ color: 'var(--text-2)', fontSize: '13px' }}>Loading…</p>}

      {loaded && (
        <>
          {/* Cost approval threshold */}
          <div style={cardStyle}>
            <label htmlFor="costThreshold" style={fieldLabel}>Cost approval threshold (USD)</label>
            <input
              id="costThreshold" type="number" min={1} value={costThreshold}
              onChange={(e) => setCostThreshold(Number(e.target.value))}
              style={numberInput(Boolean(costError))}
            />
            {costError && <p style={{ ...helperText, color: 'var(--error)' }}>{costError}</p>}
            <p style={helperText}>Shipments above this amount require human approval before proceeding.</p>
          </div>

          {/* Auto-approve below */}
          <div style={cardStyle}>
            <label htmlFor="autoApprove" style={fieldLabel}>Auto-approve below (USD)</label>
            <input
              id="autoApprove" type="number" min={0} value={autoApproveBelow}
              onChange={(e) => setAutoApproveBelow(Number(e.target.value))}
              style={numberInput(Boolean(autoError))}
            />
            {autoError && <p style={{ ...helperText, color: 'var(--error)' }}>{autoError}</p>}
            <p style={helperText}>
              Shipments below this amount are approved automatically. Set to 0 to disable. Must be less than the cost approval threshold.
            </p>
          </div>

          {/* Approved carriers */}
          <div style={cardStyle}>
            <label style={fieldLabel}>Approved carriers</label>
            <CarrierInput carriers={approvedCarriers} onChange={setApprovedCarriers} />
            <p style={helperText}>
              Carriers in this list bypass the new carrier check. Leave empty to require a check on all carriers.
            </p>
          </div>

          {/* Require broker verification */}
          <div style={cardStyle}>
            <label style={fieldLabel}>Require customs broker verification</label>
            <button
              role="switch"
              aria-checked={requireBrokerVerify}
              onClick={() => setRequireBrokerVerify((v) => !v)}
              style={{
                width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                background: requireBrokerVerify ? 'var(--brand)' : 'var(--border-strong)',
                position: 'relative', transition: 'background 0.15s', padding: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: '2px', left: requireBrokerVerify ? '22px' : '2px',
                width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
              }} />
            </button>
            <p style={helperText}>When enabled, unverified customs brokers trigger the customs flag guardrail.</p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
            <button
              onClick={() => void save()} disabled={!canSave}
              style={{
                padding: '8px 18px', background: 'var(--brand)', border: 'none', borderRadius: '8px',
                fontSize: '13px', fontWeight: 500, color: '#fff', fontFamily: 'var(--sans)',
                cursor: canSave ? 'pointer' : 'default', opacity: canSave ? 1 : 0.4,
              }}
            >{saving ? 'Saving…' : 'Save changes'}</button>
            <button
              onClick={() => setConfirmReset(true)} disabled={saving}
              style={{
                padding: '8px 16px', background: 'transparent', border: '1px solid var(--error)',
                borderRadius: '8px', fontSize: '13px', color: 'var(--error)', cursor: 'pointer', fontFamily: 'var(--sans)',
              }}
            >Reset to defaults</button>
          </div>
        </>
      )}

      {/* Reset confirmation */}
      {confirmReset && (
        <div onClick={() => setConfirmReset(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(3,6,16,0.72)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '380px', maxWidth: '90vw', background: 'var(--surface)',
            border: '1px solid var(--border-strong)', borderRadius: '12px', padding: '22px',
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '10px' }}>Reset to platform defaults?</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px', lineHeight: 1.5 }}>
              This deletes your custom guardrail configuration. Your tenants will use Progue&rsquo;s platform defaults until you set it again.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setConfirmReset(false)} style={{
                padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-strong)',
                borderRadius: '8px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'var(--sans)',
              }}>Cancel</button>
              <button onClick={() => void reset()} style={{
                padding: '8px 16px', background: 'var(--error)', border: 'none', borderRadius: '8px',
                fontSize: '13px', fontWeight: 500, color: '#fff', cursor: 'pointer', fontFamily: 'var(--sans)',
              }}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
