import LandingLayout from './landing/LandingLayout';
import { about } from '../content/landing';

export default function AboutPage() {
  return (
    <LandingLayout>
      <section className="px-6 py-24">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono text-2xs tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--text-3)' }}>
            {about.label}
          </p>
          <h1 className="text-[28px] md:text-[44px] font-medium leading-tight mb-8" style={{ color: 'var(--text)' }}>
            {about.headline}
          </h1>
          <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--text-2)' }}>
            {about.body}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Get in touch:{' '}
            <a
              href={`mailto:${about.contact}`}
              style={{ color: 'var(--brand)' }}
              className="no-underline hover:underline"
            >
              {about.contact}
            </a>
          </p>
        </div>
      </section>
    </LandingLayout>
  );
}
