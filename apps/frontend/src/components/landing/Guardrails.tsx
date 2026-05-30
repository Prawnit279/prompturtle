import { useReveal } from '../../hooks/useReveal';
import { guardrailsContent } from '../../content/avgstar';

export default function Guardrails(): React.ReactElement {
  const ref = useReveal();
  const c = guardrailsContent;

  return (
    <section className="section veiled" ref={ref}>
      <div className="rail">
        <div className="mlabel reveal">
          <span className="sq" /><span className="num">{c.num}</span> · {c.label}
        </div>
        <h2 className="section-h reveal" style={{ marginBottom: 'clamp(32px,5vh,52px)', maxWidth: '18ch' }}>
          {c.h2}
        </h2>
        <div className="guard-grid">
          {c.cards.map(card => (
            <div key={card.k} className="guard-card reveal">
              <div className="gk">{card.k}</div>
              <div className="gt">{card.t}</div>
              <div className="gd">{card.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
