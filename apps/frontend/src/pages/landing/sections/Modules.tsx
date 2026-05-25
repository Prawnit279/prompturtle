import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { modules } from '../../../content/landing';

export default function Modules() {
  const { ref, visible } = useScrollReveal();

  return (
    <section id="modules" className="px-6 py-24 border-t" style={{ borderColor: 'var(--border)' }}>
      <div
        ref={ref}
        className="max-w-5xl mx-auto transition-all duration-500 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)' }}
      >
        <p className="font-mono text-2xs tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--text-3)' }}>
          03 / PHASE 1 MODULES
        </p>
        <h2 className="text-[22px] md:text-[32px] font-medium leading-snug mb-12" style={{ color: 'var(--text)' }}>
          Built for the logistics execution layer.
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {modules.filter(m => m.phase === 1).map(mod => (
            <div
              key={mod.tag}
              className="rounded-lg border p-5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{mod.name}</p>
                <span
                  className="font-mono text-2xs px-2 py-0.5 rounded-full border"
                  style={{ color: 'var(--brand)', borderColor: 'var(--brand)', opacity: 0.7 }}
                >
                  {mod.tag}
                </span>
              </div>
              <div className="space-y-1.5">
                {mod.tools.map(tool => (
                  <div key={tool} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--text-3)' }} />
                    <span className="font-mono text-2xs" style={{ color: 'var(--text-3)' }}>{tool}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
