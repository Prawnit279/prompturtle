import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { navContent } from '../../content/avgstar';
import ProgueLogo from '../ProgueLogo';

export default function Nav(): React.ReactElement {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const c = navContent;

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
      <div className="rail">
        <Link to="/" className="wm" style={{ lineHeight: 0 }}>
          <ProgueLogo height={44} />
        </Link>
        <div className="nav-links">
          {c.links.map(link => (
            <Link key={link.to} to={link.to}>{link.label}</Link>
          ))}
          <a href={c.ctaHref} className="pill">{c.cta}</a>
        </div>
        <button
          className="nav-burger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen(o => !o)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            {menuOpen
              ? <><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></>
              : <><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></>
            }
          </svg>
        </button>
      </div>
      <div className={`nav-mobile${menuOpen ? ' open' : ''}`}>
        {c.links.map(link => (
          <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)}>{link.label}</Link>
        ))}
        <a href={c.ctaHref} onClick={() => setMenuOpen(false)}>{c.cta}</a>
      </div>
    </nav>
  );
}
