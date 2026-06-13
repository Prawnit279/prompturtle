import { Link, NavLink, Outlet } from 'react-router-dom';

/**
 * Docs shell: left sidebar nav + main content area.
 * Sidebar is hidden below 768px (mobile out of scope for v1).
 * Self-contained — wordmark links home, CTA in the footer.
 */

interface NavItem {
  label: string;
  to: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    title: 'Getting started',
    items: [
      { label: 'Quickstart', to: '/docs/quickstart' },
      { label: 'Authentication', to: '/docs/authentication' },
      { label: 'Installation', to: '/docs/installation' },
    ],
  },
  {
    title: 'Core concepts',
    items: [
      { label: 'How Progue works', to: '/docs/concepts/overview' },
      { label: 'The context call lifecycle', to: '/docs/concepts/lifecycle' },
      { label: 'Response envelope & audit IDs', to: '/docs/concepts/envelope' },
      { label: 'Multi-tenancy & isolation', to: '/docs/concepts/multi-tenancy' },
      { label: 'Guardrails', to: '/docs/concepts/guardrails' },
      { label: 'Memory', to: '/docs/concepts/memory' },
    ],
  },
  {
    title: 'Modules',
    items: [
      { label: 'BOL Processor', to: '/docs/api/bol' },
      { label: 'Carrier Rates', to: '/docs/api/carrier' },
      { label: 'HTS Classifier', to: '/docs/api/hts' },
      { label: 'Approval Workflow', to: '/docs/api/approval' },
      { label: 'Audit Trail', to: '/docs/api/audit' },
      { label: 'Shipment Risk Score', to: '/docs/api/risk' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { label: 'Errors & status codes', to: '/docs/reference/errors' },
      { label: 'Rate limits & quotas', to: '/docs/reference/rate-limits' },
      { label: 'Versioning & changelog', to: '/docs/reference/versioning' },
      { label: 'Webhooks', to: '/docs/reference/webhooks' },
    ],
  },
  {
    title: 'Guides',
    items: [
      { label: 'Vendor onboarding', to: '/docs/guides/vendor-onboarding' },
      { label: 'End-to-end BOL flow', to: '/docs/guides/bol-flow' },
      { label: 'Wiring approval roles', to: '/docs/guides/approval-roles' },
      { label: 'Exporting audit reports', to: '/docs/guides/audit-export' },
    ],
  },
];

const STANDALONE: NavItem[] = [
  { label: 'Roadmap modules (preview)', to: '/docs/roadmap' },
  { label: 'FAQ & troubleshooting', to: '/docs/faq' },
];

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  isActive
    ? 'block py-1.5 text-[13px] font-medium border-l-2 border-[var(--brand)] pl-3 text-[var(--text)]'
    : 'block py-1.5 text-[13px] border-l-2 border-transparent pl-3 text-[var(--text-2)] hover:text-[var(--text)] transition-colors';

export default function DocsLayout() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] md:flex">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-[264px] md:shrink-0 md:h-screen md:sticky md:top-0 border-r border-[var(--border)] bg-[var(--surface)]">
        {/* Wordmark */}
        <div className="h-14 flex items-center px-6 border-b border-[var(--border)]">
          <Link to="/" className="text-[16px] font-medium tracking-[-0.02em] no-underline text-[var(--text)]">
            progue<span className="text-[var(--brand)]">.</span>
          </Link>
          <span className="ml-2 font-[family-name:var(--mono)] text-[10px] uppercase tracking-[0.1em] text-[var(--text-3)]">
            Docs
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-4 py-5">
          {SECTIONS.map((section) => (
            <div key={section.title} className="mb-5">
              <p className="px-3 mb-1.5 font-[family-name:var(--mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--text-3)]">
                {section.title}
              </p>
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} end className={linkClass}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="mb-2 border-t border-[var(--border)] pt-4">
            {STANDALONE.map((item) => (
              <NavLink key={item.to} to={item.to} end className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* CTA footer */}
        <div className="px-4 py-4 border-t border-[var(--border)]">
          <a
            href="https://app.progue.ai/sign-up"
            className="block w-full text-center rounded-lg bg-[var(--brand)] px-4 py-2 text-[13px] font-medium text-white no-underline transition-opacity hover:opacity-90"
          >
            Get API key →
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
