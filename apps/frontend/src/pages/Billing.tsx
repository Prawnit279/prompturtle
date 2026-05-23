export default function Billing() {
  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 500, letterSpacing: '-0.02em', marginBottom: '6px' }}>
        Billing
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '24px' }}>
        Plan and usage billing — coming soon.
      </p>
      <div style={{
        background:   'var(--surface)',
        border:       '1px solid var(--border)',
        borderRadius: '10px',
        padding:      '48px',
        textAlign:    'center',
      }}>
        <p style={{ color: 'var(--text-2)', fontSize: '13px' }}>
          Billing management will be available in the next update.
        </p>
        <p style={{ color: 'var(--text-3)', fontSize: '11px', fontFamily: 'var(--mono)', marginTop: '8px' }}>
          Stripe integration: PR 5.2
        </p>
      </div>
    </div>
  );
}
