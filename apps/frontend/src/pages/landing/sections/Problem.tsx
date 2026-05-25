import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { problem } from '../../../content/landing';

export default function Problem() {
  const { ref, visible } = useScrollReveal();

  return (
    <section className="px-6 py-24 border-t" style={{ borderColor: 'var(--border)' }}>
      <div
        ref={ref}
        className="max-w-5xl mx-auto transition-all duration-500 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)' }}
      >
        <p className="font-mono text-2xs tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--text-3)' }}>
          {problem.label}
        </p>
        <h2 className="text-[22px] md:text-[32px] font-medium leading-snug mb-6 max-w-2xl" style={{ color: 'var(--text)' }}>
          {problem.headline}
        </h2>
        <p className="text-base leading-relaxed mb-10 max-w-2xl" style={{ color: 'var(--text-2)' }}>
          {problem.body}
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {problem.cards.map(card => (
            <div
              key={card.title}
              className="px-5 py-4 rounded-lg border text-sm font-medium"
              style={{
                background:  'var(--surface)',
                borderColor: 'var(--border)',
                color:       'var(--text-2)',
              }}
            >
              {card.title}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
