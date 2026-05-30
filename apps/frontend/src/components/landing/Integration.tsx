import { useReveal } from '../../hooks/useReveal';
import { integrationContent } from '../../content/avgstar';

type VehicleType = 'truck' | 'ship' | 'plane';

const VEHICLES: Record<VehicleType, React.ReactElement> = {
  truck: (
    <svg width="22" height="14" viewBox="0 0 30 18" fill="currentColor" aria-hidden="true">
      <rect x="1" y="3" width="15" height="9" rx="1"/>
      <path d="M16 6 h6 l4 4 v2 h-10 z"/>
      <circle cx="7" cy="14" r="2.4"/><circle cx="21" cy="14" r="2.4"/>
    </svg>
  ),
  ship: (
    <svg width="24" height="14" viewBox="0 0 32 18" fill="currentColor" aria-hidden="true">
      <path d="M3 9 h26 l-3 6 h-20 z"/>
      <rect x="13" y="2" width="3" height="7"/>
      <rect x="17" y="4" width="7" height="5"/>
    </svg>
  ),
  plane: (
    <svg width="22" height="14" viewBox="0 0 30 18" fill="currentColor" aria-hidden="true">
      <path d="M2 9 L20 4 L28 9 L20 14 Z"/>
      <path d="M11 9 L7 2 H9 L15 9 L9 16 H7 Z"/>
    </svg>
  ),
};

function Vehicle({ type }: { type: VehicleType }): React.ReactElement {
  return <div className={`vehicle veh-${type}`}>{VEHICLES[type]}</div>;
}

export default function Integration(): React.ReactElement {
  const ref = useReveal();
  const c = integrationContent;

  return (
    <section className="section veiled" ref={ref}>
      <div className="rail">
        <div className="mlabel reveal">
          <span className="sq" /><span className="num">{c.num}</span> · {c.label}
        </div>
        <h2 className="section-h reveal" style={{ maxWidth: '22ch' }}>{c.h2}</h2>
        <div className="flowpanel reveal">
          <div className="grid-bg" />
          <div className="flow">
            <div className="node">
              <div className="nt">Your product</div>
              <div className="ns">TMS · 3PL · TPM</div>
            </div>
            <div className="conn"><div className="line" /><Vehicle type="truck" /></div>
            <div className="node brand">
              <div className="nt">Progue API</div>
              <div className="ns">REST + streaming</div>
            </div>
            <div className="conn"><div className="line" /><Vehicle type="ship" /></div>
            <div className="engine">
              <div className="etitle">Context Engine</div>
              {c.engine.map(([key, val]) => (
                <div key={key} className={`erow${key === 'guardrails' ? ' g' : ''}`}>
                  <span className="ek">{key}</span>
                  <span className="ev">{val}</span>
                </div>
              ))}
            </div>
            <div className="conn"><div className="line" /><Vehicle type="plane" /></div>
            <div className="flow-branch">
              <div className="node" style={{ minWidth: 108 }}>
                <div className="nt">Audit log</div>
                <div className="ns">append-only</div>
              </div>
              <div className="branch-up">↑</div>
              <div className="node">
                <div className="nt">Claude</div>
                <div className="ns">opus · sonnet</div>
              </div>
            </div>
            <div className="conn"><div className="line" /><Vehicle type="truck" /></div>
            <div className="node">
              <div className="nt">Your product</div>
              <div className="ns">decision payload</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
