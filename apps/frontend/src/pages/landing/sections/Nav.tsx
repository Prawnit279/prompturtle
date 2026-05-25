import { Link } from 'react-router-dom';

const NAV_LINKS = [
  { label: 'Solutions', to: '/solutions' },
  { label: 'Docs',      to: '/docs'      },
  { label: 'Pricing',   to: '/pricing'   },
  { label: 'About',     to: '/about'     },
] as const;

export default function Nav() {
  return (
    <header
      className="sticky top-0 z-50 h-topbar flex items-center border-b"
      style={{
        background:   'color-mix(in srgb, var(--surface) 85%, transparent)',
        backdropFilter: 'blur(8px)',
        borderColor:  'var(--border)',
      }}
    >
      <div className="max-w-5xl mx-auto w-full px-6 flex items-center justify-between">
        <Link
          to="/"
          className="font-sans text-lg font-medium no-underline"
          style={{ color: 'var(--text)' }}
        >
          progue<span style={{ color: 'var(--brand)' }}>.</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm no-underline transition-colors text-text-2 hover:text-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <a
          href="https://app.progue.ai/sign-up"
          className="hidden md:inline-flex items-center px-4 py-2 rounded-full text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--brand)' }}
        >
          Get API key →
        </a>
      </div>
    </header>
  );
}
