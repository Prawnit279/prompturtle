import LandingLayout from './landing/LandingLayout';
import { solutions } from '../content/landing';

export default function SolutionsPage() {
  return (
    <LandingLayout>
      <section className="px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-2xs tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--text-3)' }}>
            {solutions.label}
          </p>
          <h1 className="text-[28px] md:text-[44px] font-medium leading-tight mb-14" style={{ color: 'var(--text)' }}>
            {solutions.headline}
          </h1>

          <div className="space-y-0">
            {solutions.segments.map(seg => (
              <div
                key={seg.name}
                className="py-8 border-b grid md:grid-cols-3 gap-6"
                style={{ borderColor: 'var(--border)' }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{seg.name}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{seg.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
