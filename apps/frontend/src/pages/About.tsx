import '../styles/landing.css';

import { useReveal } from '../hooks/useReveal';
import Shell from '../components/landing/Shell';
import { aboutPageContent } from '../content/avgstar';

function AboutBody(): React.ReactElement {
  const ref = useReveal();
  const c = aboutPageContent;

  return (
    <>
      {/* Hero */}
      <header className="hero" style={{ minHeight: '50vh', paddingTop: 120, paddingBottom: 60 }}>
        <div className="eyebrow"><span className="sq" />{c.eyebrow}</div>
        <h1 style={{ fontSize: 'clamp(38px,5.5vw,72px)', maxWidth: '20ch' }}>{c.h1}</h1>
      </header>

      {/* Mission */}
      <section className="section veiled" ref={ref}>
        <div className="rail">
          <div className="mlabel reveal">
            <span className="sq" />Mission
          </div>
          <div className="reveal" style={{ maxWidth: '66ch', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {c.body.map((p, i) => (
              <p key={i} className="lede" style={{ fontSize: 'clamp(15px,1.5vw,19px)' }}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="section veiled">
        <div className="rail">
          <div className="mlabel">
            <span className="sq" />{c.principlesLabel}
          </div>
          <div className="prob-cards" style={{ maxWidth: 720 }}>
            {c.principles.map(p => (
              <div key={p.n} className="prob-card" style={{ '--c': p.c } as React.CSSProperties}>
                <span className="idx">{p.n}</span>
                <div>
                  <div className="ct">{p.t}</div>
                  <div className="cd">{p.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="section veiled" style={{ paddingTop: 'clamp(60px,8vh,96px)', paddingBottom: 'clamp(80px,12vh,140px)' }}>
        <div className="rail">
          <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
            Get in touch
          </p>
          <a
            href={`mailto:${c.contact}`}
            style={{ fontSize: 'clamp(20px,2.5vw,32px)', color: 'var(--brand-lift)', fontWeight: 500, textDecoration: 'none', letterSpacing: '-0.01em' }}
          >
            {c.contact}
          </a>
        </div>
      </section>
    </>
  );
}

export default function About(): React.ReactElement {
  return (
    <Shell>
      <AboutBody />
    </Shell>
  );
}
