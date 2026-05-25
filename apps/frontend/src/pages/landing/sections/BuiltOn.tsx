import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { builtOn } from '../../../content/landing';

export default function BuiltOn() {
  const { ref, visible } = useScrollReveal();

  return (
    <section className="px-6 py-20 border-t" style={{ borderColor: 'var(--border)' }}>
      <div
        ref={ref}
        className="max-w-5xl mx-auto transition-all duration-500 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)' }}
      >
        <p className="font-mono text-2xs tracking-[0.2em] uppercase mb-8" style={{ color: 'var(--text-3)' }}>
          {builtOn.label}
        </p>

        {/* Customer logos row — appears automatically when customers array is filled */}
        {builtOn.customers.length > 0 && (
          <div className="flex flex-wrap gap-8 items-center mb-10">
            {builtOn.customers.map(c => (
              <img key={c.name} src={c.logoUrl} alt={c.name} className="h-6 opacity-60" />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-6">
          {builtOn.technologies.map(tech => (
            <span
              key={tech}
              className="px-3 py-1.5 rounded-full border text-sm font-medium"
              style={{
                background:  'var(--surface)',
                borderColor: 'var(--border)',
                color:       'var(--text-2)',
              }}
            >
              {tech}
            </span>
          ))}
        </div>

        <p className="text-sm" style={{ color: 'var(--text-3)' }}>{builtOn.tagline}</p>
      </div>
    </section>
  );
}
