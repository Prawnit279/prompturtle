import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { PLANS } from '../../../content/plans';

export default function PricingSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <section className="px-6 py-24 border-t" style={{ borderColor: 'var(--border)' }}>
      <div
        ref={ref}
        className="max-w-6xl mx-auto transition-all duration-500 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)' }}
      >
        <p className="font-mono text-2xs tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--text-3)' }}>
          07 / PRICING
        </p>
        <h2 className="text-[22px] md:text-[32px] font-medium leading-snug mb-12" style={{ color: 'var(--text)' }}>
          Start free. Scale when you&rsquo;re ready.
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map(plan => (
            <div
              key={plan.tier}
              className="rounded-lg border p-6 flex flex-col"
              style={{
                background:  plan.recommended
                  ? 'radial-gradient(circle at 50% 0%, rgba(91,58,130,0.10) 0%, transparent 55%), var(--surface)'
                  : 'var(--surface)',
                borderColor: plan.recommended ? 'var(--brand)' : 'var(--border)',
              }}
            >
              {plan.recommended && (
                <span
                  className="self-start mb-4 font-mono text-2xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--brand)', color: '#fff', opacity: 0.9 }}
                >
                  recommended
                </span>
              )}

              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-2)' }}>{plan.name}</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[36px] font-medium leading-none" style={{ color: 'var(--text)' }}>
                  ${plan.priceUsd}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-3)' }}>/ mo</span>
              </div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{plan.calls}</p>
              <p className="text-xs mb-6" style={{ color: 'var(--text-3)' }}>{plan.rateLimit}</p>

              <ul className="space-y-2 flex-1 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
                    <span className="mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--success)' }} />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={plan.ctaHref}
                className="w-full py-2.5 rounded text-sm font-medium text-center transition-opacity hover:opacity-90"
                style={{
                  background:  plan.recommended ? 'var(--brand)' : 'var(--surface-raised)',
                  color:       plan.recommended ? '#fff'          : 'var(--text)',
                  border:      plan.recommended ? 'none'          : `1px solid var(--border)`,
                }}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
