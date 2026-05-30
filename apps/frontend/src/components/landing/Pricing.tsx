import { useReveal } from '../../hooks/useReveal';
import { pricingContent } from '../../content/avgstar';

function Check(): React.ReactElement {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.3" opacity="0.5"/>
      <path d="M6 10.5 L9 13.5 L14.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function Pricing(): React.ReactElement {
  const ref = useReveal();
  const c = pricingContent;

  return (
    <section className="section veiled" ref={ref}>
      <div className="rail">
        <div className="mlabel reveal">
          <span className="sq" /><span className="num">{c.num}</span> · {c.label}
        </div>
        <div className="price-head reveal">
          <h2 className="section-h">{c.h2}</h2>
          <p className="lede" style={{ maxWidth: '40ch' }}>{c.sub}</p>
        </div>
        <div className="price-grid">
          {c.tiers.map(tier => (
            <div key={tier.name} className={`price-card reveal${tier.reco ? ' reco' : ''}`}>
              {tier.flag && <div className="reco-flag">{tier.flag}</div>}
              <div className="price-top">
                <span className="tier-name">{tier.name}</span>
                <span className="tier-tag">{tier.tag}</span>
              </div>
              <div className="price-amt">
                {tier.amt}<span className="per">{tier.per}</span>
              </div>
              <div className="price-meta">
                {tier.meta.map((m, i) => <div key={i}>{m}</div>)}
              </div>
              <ul className="price-feats">
                {tier.feats.map((f, i) => (
                  <li key={i}><Check />{f}</li>
                ))}
              </ul>
              <a href={tier.ctaHref} className={`price-cta ${tier.ctaKind}`}>{tier.cta}</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
