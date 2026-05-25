import { Link } from 'react-router-dom';
import { footer } from '../../../content/landing';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="px-6 pt-14 pb-8 border-t" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-5xl mx-auto">
        {/* Top row: wordmark + columns */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-14">
          {/* Wordmark + tagline */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="font-sans text-lg font-medium no-underline" style={{ color: 'var(--text)' }}>
              progue<span style={{ color: 'var(--brand)' }}>.</span>
            </Link>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-3)' }}>
              {footer.tagline}
            </p>
          </div>

          {/* Link columns */}
          {footer.columns.map(col => (
            <div key={col.heading}>
              <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-2)' }}>{col.heading}</p>
              <ul className="space-y-2">
                {col.links.map(link => (
                  <li key={link.label}>
                    {'href' in link && link.href.startsWith('mailto') ? (
                      <a
                        href={link.href}
                        className="text-xs no-underline transition-colors"
                        style={{ color: 'var(--text-3)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-3)'; }}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-xs no-underline transition-colors"
                        style={{ color: 'var(--text-3)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-3)'; }}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
        >
          <div className="flex items-center gap-4">
            <span>© {year} Progue</span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--success)' }}
              />
              All systems operational
            </span>
          </div>
          <div className="flex items-center gap-4">
            {footer.social.map(s => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline transition-colors"
                style={{ color: 'var(--text-3)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-3)'; }}
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
