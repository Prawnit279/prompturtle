import LandingLayout from './landing/LandingLayout';

export default function DocsPage() {
  return (
    <LandingLayout>
      <section className="px-6 py-24">
        <div className="max-w-3xl mx-auto">
          <p className="font-mono text-2xs tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--text-3)' }}>
            DEVELOPERS
          </p>
          <h1 className="text-[28px] md:text-[44px] font-medium leading-tight mb-5" style={{ color: 'var(--text)' }}>
            Documentation
          </h1>
          <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--text-2)' }}>
            Full API reference, quickstart guides, and module documentation.
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            {([
              { title: 'API Reference',  desc: 'Complete endpoint and tool reference for all modules.',     href: '#api-reference' },
              { title: 'Quickstart',     desc: 'Get your first classified HTS code in under five minutes.', href: '#quickstart' },
              { title: 'Vendor Guide',   desc: 'Zero-to-first-call onboarding for integration teams.',      href: '#vendor-guide' },
            ] as const).map(doc => (
              <a
                key={doc.title}
                href={doc.href}
                className="block rounded-lg border p-5 no-underline transition-colors group"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-strong)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'; }}
              >
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>{doc.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>{doc.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
