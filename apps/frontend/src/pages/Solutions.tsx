import '../styles/landing.css';

import { useReveal } from '../hooks/useReveal';
import Shell from '../components/landing/Shell';
import { solutionsPageContent } from '../content/avgstar';

function SolutionsBody(): React.ReactElement {
  const ref = useReveal();
  const c = solutionsPageContent;

  return (
    <>
      {/* Hero */}
      <header className="hero" style={{ minHeight: '50vh', paddingTop: 120, paddingBottom: 60 }}>
        <div className="eyebrow"><span className="sq" />{c.eyebrow}</div>
        <h1 style={{ fontSize: 'clamp(38px,5.5vw,72px)' }}>{c.h1}</h1>
        <p className="sub" style={{ marginBottom: 0 }}>{c.sub}</p>
      </header>

      {/* Segments */}
      <section className="section veiled" ref={ref}>
        <div className="rail">
          <div className="mlabel reveal">
            <span className="sq" />Segments
          </div>
          <div className="prob-cards" style={{ maxWidth: 760 }}>
            {c.segments.map(seg => (
              <div key={seg.n} className="prob-card reveal" style={{ '--c': seg.c } as React.CSSProperties}>
                <span className="idx">{seg.n}</span>
                <div>
                  <div className="ct">{seg.t}</div>
                  <div className="cd">{seg.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section veiled">
        <div className="rail">
          <div className="mlabel">
            <span className="sq" />{c.faqLabel}
          </div>
          <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {c.faq.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '22px 0',
                  borderBottom: '1px solid var(--hair)',
                }}
              >
                <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>{item.q}</p>
                <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default function Solutions(): React.ReactElement {
  return (
    <Shell>
      <SolutionsBody />
    </Shell>
  );
}
