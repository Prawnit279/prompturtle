import { Link } from 'react-router-dom';

const CARDS = [
  {
    title: 'Quickstart',
    desc: 'Make your first API call in under five minutes. No setup beyond an API key.',
    to: '/docs/quickstart',
  },
  {
    title: 'API Reference',
    desc: 'Complete reference for every module, tool, parameter, and response field.',
    to: '/docs/api/bol',
  },
  {
    title: 'Vendor Guide',
    desc: 'Zero-to-first-call onboarding for teams integrating Progue into a product.',
    to: '/docs/guides/vendor-onboarding',
  },
] as const;

export default function DocsIndex() {
  return (
    <article>
      <p className="mb-3 font-[family-name:var(--mono)] text-[11px] uppercase tracking-[0.1em] text-[var(--text-3)]">
        Documentation
      </p>
      <h1 className="text-[34px] font-medium tracking-[-0.02em] text-[var(--text)] mb-3">Documentation</h1>
      <p className="text-[16px] leading-7 text-[var(--text-2)] mb-4">
        Full API reference, quickstart guides, and module documentation.
      </p>

      <div className="mb-10 rounded-r-lg border-l-4 border-[var(--info)] bg-[var(--surface-raised)] p-4">
        <p className="mb-2 font-[family-name:var(--mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--info)]">
          Plain English
        </p>
        <p className="text-[14px] leading-7 text-[var(--text-2)]">
          This is the documentation for Progue. If you&rsquo;re new, start with the Quickstart — it takes less than
          five minutes to make your first API call. If you&rsquo;re a developer integrating Progue into a product,
          the Vendor Onboarding guide is the fastest path from zero to a working integration. Everything here is
          written to be honest about what&rsquo;s live versus what&rsquo;s coming.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 no-underline transition-colors hover:border-[var(--border-strong)]"
          >
            <p className="mb-2 text-[14px] font-medium text-[var(--text)]">{card.title}</p>
            <p className="text-[12.5px] leading-5 text-[var(--text-3)]">{card.desc}</p>
          </Link>
        ))}
      </div>
    </article>
  );
}
