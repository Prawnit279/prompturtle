import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { pricingTiers } from '../../../content/landing';

export default function PricingSection() {
  const { ref, visible } = useScrollReveal();

  return (
    <section className="px-6 py-24 border-t" style={{ borderColor: 'var(--border)' }}>
      <div
        ref={ref}
        className="max-w-5xl mx-auto transition-all duration-500 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)' }}
      >
        <p className="font-mono text-2xs tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--text-3)' }}>
          07 / PRICING
        </p>
        <h2 className="text-[22px] md:text-[32px] font-medium leading-snug mb-12" style={{ color: 'var(--text)' }}>
          Simple, transparent pricing.
        </h2>

        <div className="grid md:grid-cols-3 gap-4">
          {pricingTiers.map(tier => (
            <div
              key={tier.name}
              className="rounded-lg border p-6 flex flex-col"
              style={{
                background:  tier.highlighted
                  ? 'radial-gradient(circle at 50% 0%, rgba(91,58,130,0.10) 0%, transparent 55%), var(--surface)'
                  : 'var(--surface)',
                borderColor: tier.highlighted ? 'var(--brand)' : 'var(--border)',
              }}
            >
              {tier.highlighted && (
                <span
                  className="self-start mb-4 font-mono text-2xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--brand)', color: '#fff', opacity: 0.9 }}
                >
                  recommended
                </span>
              )}

              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-2)' }}>{tier.name}</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[36px] font-medium leading-none" style={{ color: 'var(--text)' }}>
                  ${tier.price}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-3)' }}>/ {tier.period}</span>
              </div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{tier.calls}</p>
              <p className="text-xs mb-6" style={{ color: 'var(--text-3)' }}>{tier.rateLimit}</p>

              <ul className="space-y-2 flex-1 mb-8">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
                    <span className="mt-[5px] w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--success)' }} />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={tier.ctaHref}
                className="w-full py-2.5 rounded text-sm font-medium text-center transition-opacity hover:opacity-90"
                style={{
                  background:  tier.highlighted ? 'var(--brand)' : 'var(--surface-raised)',
                  color:       tier.highlighted ? '#fff'          : 'var(--text)',
                  border:      tier.highlighted ? 'none'          : `1px solid var(--border)`,
                }}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
