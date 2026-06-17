import { Link } from 'react-router-dom';
import { footerContent } from '../../content/avgstar';
import ProgueLogo from '../ProgueLogo';

export default function Footer(): React.ReactElement {
  const c = footerContent;
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="rail">
        <div className="footer-grid">
          <div>
            <div className="wm">
              <ProgueLogo height={26} />
            </div>
            <div className="tag">{c.tag}</div>
          </div>
          {c.cols.map(col => (
            <div key={col.h} className="fcol">
              <h4>{col.h}</h4>
              {col.links.map(link =>
                link.to.startsWith('mailto:') ? (
                  <a key={link.label} href={link.to}>{link.label}</a>
                ) : (
                  <Link key={link.label} to={link.to}>{link.label}</Link>
                )
              )}
            </div>
          ))}
        </div>
        <div className="footer-base">
          <span>{c.base.replace('2026', String(year))}</span>
          <span>progue.ai</span>
        </div>
      </div>
    </footer>
  );
}
