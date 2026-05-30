import { useReveal } from '../../hooks/useReveal';
import { problemContent } from '../../content/avgstar';

export default function Problem(): React.ReactElement {
  const ref = useReveal();
  const c = problemContent;

  return (
    <section className="section veiled" ref={ref}>
      <div className="rail">
        <div className="mlabel reveal">
          <span className="sq" /><span className="num">{c.num}</span> · {c.label}
        </div>
        <div className="problem-grid">
          <div className="reveal">
            <h2 className="section-h">{c.h2}</h2>
            {c.body.map((p, i) => (
              <p key={i} className="lede" style={{ marginTop: 22 }}>{p}</p>
            ))}
            <p className="mono-note" style={{ marginTop: 20 }}>{c.note}</p>
          </div>
          <div className="prob-cards reveal">
            {c.cards.map(card => (
              <div key={card.n} className="prob-card" style={{ '--c': card.c } as React.CSSProperties}>
                <span className="idx">{card.n}</span>
                <div>
                  <div className="ct">{card.t}</div>
                  <div className="cd">{card.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
