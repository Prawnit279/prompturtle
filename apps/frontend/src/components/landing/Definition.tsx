import { useReveal } from '../../hooks/useReveal';
import { definitionContent } from '../../content/avgstar';

export default function Definition(): React.ReactElement {
  const ref = useReveal();
  const c = definitionContent;

  return (
    <section className="section veiled" ref={ref}>
      <div className="rail">
        <div className="mlabel reveal">
          <span className="sq" /><span className="num">{c.num}</span> · {c.label}
        </div>
        <div className="reveal" style={{ maxWidth: '70ch' }}>
          <h2 className="section-h">{c.h2}</h2>
          <p className="lede" style={{ marginTop: 26, fontSize: 18 }}>{c.body}</p>
          <p className="mono-note" style={{ marginTop: 18 }}>{c.note}</p>
        </div>
        <div className="def-row reveal">
          {c.row.map(([key, val]) => (
            <div key={key} className="def-cell">
              <span className="dk">{key}</span>
              <span className="dv">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
