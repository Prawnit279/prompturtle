import { useReveal } from '../../hooks/useReveal';
import { modulesContent, type GlyphType } from '../../content/avgstar';

const GLYPHS: Record<GlyphType, React.ReactElement> = {
  doc: (
    <g fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="18" height="26" rx="2" stroke="currentColor"/>
      <line x1="11" y1="11" x2="19" y2="11" stroke="currentColor"/>
      <line x1="11" y1="16" x2="19" y2="16" stroke="currentColor"/>
      <line x1="11" y1="21" x2="16" y2="21" stroke="currentColor"/>
      <circle cx="32" cy="28" r="4" className="hot"/>
    </g>
  ),
  tree: (
    <g fill="none" strokeWidth="1.5">
      <rect x="4" y="6" width="12" height="7" rx="1.5" stroke="currentColor"/>
      <rect x="4" y="19" width="12" height="7" rx="1.5" stroke="currentColor"/>
      <rect x="26" y="12.5" width="12" height="7" rx="1.5" className="hot"/>
      <path d="M16 9.5 H21 V16 H26" stroke="currentColor" strokeLinecap="round"/>
      <path d="M16 22.5 H21 V16" stroke="currentColor" strokeLinecap="round"/>
    </g>
  ),
  hex: (
    <g fill="none" strokeWidth="1.5">
      <path d="M16 4 L27 10 V22 L16 28 L5 22 V10 Z" stroke="currentColor"/>
      <circle cx="16" cy="16" r="3" className="hot"/>
    </g>
  ),
  branch: (
    <g fill="none" strokeWidth="1.5">
      <circle cx="7" cy="16" r="3.5" stroke="currentColor"/>
      <rect x="26" y="6" width="11" height="8" rx="1.5" className="hot"/>
      <rect x="26" y="20" width="11" height="8" rx="1.5" stroke="currentColor"/>
      <path d="M10.5 16 H18 V10 H26 M18 16 V24 H26" stroke="currentColor" strokeLinecap="round"/>
    </g>
  ),
  chain: (
    <g fill="none" strokeWidth="1.5">
      <rect x="4" y="11" width="14" height="10" rx="5" stroke="currentColor"/>
      <rect x="20" y="11" width="14" height="10" rx="5" className="hot"/>
      <line x1="14" y1="16" x2="24" y2="16" stroke="currentColor"/>
    </g>
  ),
};

export default function Modules(): React.ReactElement {
  const ref = useReveal();
  const c = modulesContent;

  return (
    <section className="section veiled" ref={ref}>
      <div className="rail">
        <div className="mlabel reveal">
          <span className="sq" /><span className="num">{c.num}</span> · {c.label}
        </div>
        <h2 className="section-h reveal" style={{ marginBottom: 'clamp(36px,5vh,60px)', maxWidth: '18ch' }}>
          {c.h2}
        </h2>
        <div className="mod-grid">
          {c.cards.map(card => (
            <div key={card.n} className="mod-card reveal">
              <svg className="mod-glyph" viewBox="0 0 42 36" aria-hidden="true">
                {GLYPHS[card.glyph]}
              </svg>
              <div className="mhead">Module · {card.n}</div>
              <h3>{card.t}</h3>
              <p className="mdesc">{card.d}</p>
              <div className="mod-tools">
                {card.tools.map(tool => <span key={tool}>{tool}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
