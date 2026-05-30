import { useReveal } from '../../hooks/useReveal';
import { finalContent } from '../../content/avgstar';

export default function Final(): React.ReactElement {
  const ref = useReveal();
  const c = finalContent;

  return (
    <section className="final veiled" ref={ref}>
      <div className="rail reveal">
        <h2>{c.h2}</h2>
        <div className="ctas">
          {c.ctas.map(btn => (
            <a key={btn.label} href={btn.href} className={btn.kind}>{btn.label}</a>
          ))}
        </div>
      </div>
    </section>
  );
}
