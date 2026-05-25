import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { finalCta } from '../../../content/landing';

export default function FinalCTA() {
  const { ref, visible } = useScrollReveal();

  return (
    <section className="px-6 py-28 border-t" style={{ borderColor: 'var(--border)' }}>
      <div
        ref={ref}
        className="max-w-5xl mx-auto text-center transition-all duration-500 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)' }}
      >
        <h2 className="text-[28px] md:text-[44px] font-medium leading-tight mb-8" style={{ color: 'var(--text)' }}>
          {finalCta.headline}
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href={finalCta.ctas.primary.href}
            className="inline-flex items-center px-6 py-3 rounded-full text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--brand)' }}
          >
            {finalCta.ctas.primary.label}
          </a>
          <a
            href={finalCta.ctas.secondary.href}
            className="inline-flex items-center px-6 py-3 rounded-full text-sm font-medium border transition-colors"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-2)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-2)'; }}
          >
            {finalCta.ctas.secondary.label}
          </a>
        </div>
      </div>
    </section>
  );
}
