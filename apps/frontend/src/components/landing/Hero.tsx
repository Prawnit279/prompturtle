import { heroContent } from '../../content/avgstar';

export default function Hero(): React.ReactElement {
  const c = heroContent;
  return (
    <header className="hero">
      <div className="eyebrow">
        <span className="sq" />
        {c.eyebrow}
      </div>
      <h1>
        {c.h1}<span className="mute">{c.h1mute}</span>
      </h1>
      <p className="sub">{c.sub}</p>
      <div className="ctas">
        {c.ctas.map(btn => (
          <a key={btn.label} href={btn.href} className={btn.kind}>{btn.label}</a>
        ))}
      </div>
      <div className="stats">
        {c.stats.map(([val, unit]) => (
          <span key={unit}><b>{val}</b> {unit}</span>
        ))}
      </div>
    </header>
  );
}
