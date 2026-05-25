import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { guardrails } from '../../../content/landing';

const ACTION_COLORS: Record<string, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  error:   'var(--error)',
};

export default function Guardrails() {
  const { ref, visible } = useScrollReveal();

  return (
    <section id="guardrails" className="px-6 py-24 border-t" style={{ borderColor: 'var(--border)' }}>
      <div
        ref={ref}
        className="max-w-5xl mx-auto transition-all duration-500 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)' }}
      >
        <p className="font-mono text-2xs tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--text-3)' }}>
          {guardrails.label}
        </p>
        <h2 className="text-[22px] md:text-[32px] font-medium leading-snug mb-10 max-w-2xl" style={{ color: 'var(--text)' }}>
          {guardrails.headline}
        </h2>

        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {/* Table header */}
          <div
            className="grid grid-cols-4 gap-4 px-5 py-3 border-b text-2xs font-mono uppercase tracking-widest"
            style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)', color: 'var(--text-3)' }}
          >
            <span>Rule</span>
            <span>Condition</span>
            <span>Action</span>
            <span>Approver</span>
          </div>

          {guardrails.rows.map((row, i) => (
            <div
              key={row.rule}
              className="grid grid-cols-4 gap-4 px-5 py-4 border-b last:border-b-0 text-sm"
              style={{
                background:  'var(--surface)',
                borderColor: 'var(--border)',
              }}
            >
              <span className="font-mono text-xs" style={{ color: 'var(--text-2)' }}>{row.rule}</span>
              <span style={{ color: 'var(--text-2)' }}>{row.condition}</span>
              <span className="font-medium" style={{ color: ACTION_COLORS[row.actionType] }}>{row.action}</span>
              <span className="font-mono text-xs" style={{ color: 'var(--text-3)' }}>{row.approver}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
