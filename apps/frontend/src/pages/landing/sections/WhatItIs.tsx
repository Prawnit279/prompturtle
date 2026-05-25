import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { definition } from '../../../content/landing';

export default function WhatItIs() {
  const { ref, visible } = useScrollReveal();

  return (
    <section className="px-6 py-24 border-t" style={{ borderColor: 'var(--border)' }}>
      <div
        ref={ref}
        className="max-w-5xl mx-auto transition-all duration-500 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)' }}
      >
        <p className="font-mono text-2xs tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--text-3)' }}>
          {definition.label}
        </p>
        <h2 className="text-[22px] md:text-[32px] font-medium leading-snug mb-4 max-w-2xl" style={{ color: 'var(--text)' }}>
          {definition.headline}
        </h2>
        <p className="text-base leading-relaxed mb-12 max-w-2xl" style={{ color: 'var(--text-2)' }}>
          {definition.body}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-px border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
          {definition.items.map(item => (
            <div
              key={item.term}
              className="px-5 py-5"
              style={{ background: 'var(--surface)' }}
            >
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>{item.term}</p>
              <p className="text-2xs" style={{ color: 'var(--text-3)' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
