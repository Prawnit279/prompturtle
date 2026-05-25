import { useEffect, useState } from 'react';
import { hero, heroAnimation } from '../../../content/landing';

function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return prefersReduced;
}

type AnimPhase = 'typing' | 'tracing' | 'resetting';

interface AnimState {
  chars:  number;
  traces: number;
  phase:  AnimPhase;
}

const fullCode    = heroAnimation.codeLines.join('\n');
const TOTAL_CHARS  = fullCode.length;
const TOTAL_TRACES = heroAnimation.traceLines.length;

const CHAR_DELAY   = 28;  // ms per character
const TRACE_DELAY  = 290; // ms per trace line
const LOOP_PAUSE   = 3200; // ms before resetting

const STATUS_COLOR: Record<string, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  error:   'var(--error)',
};

export default function Hero() {
  const prefersReduced = usePrefersReducedMotion();
  const [anim, setAnim] = useState<AnimState>({ chars: 0, traces: 0, phase: 'typing' });

  useEffect(() => {
    if (prefersReduced) return;

    let tid: ReturnType<typeof setTimeout>;
    const { phase, chars, traces } = anim;

    if (phase === 'typing') {
      if (chars < TOTAL_CHARS) {
        tid = setTimeout(() => setAnim(a => ({ ...a, chars: a.chars + 1 })), CHAR_DELAY);
      } else {
        tid = setTimeout(() => setAnim(a => ({ ...a, phase: 'tracing' })), 500);
      }
    } else if (phase === 'tracing') {
      if (traces < TOTAL_TRACES) {
        tid = setTimeout(() => setAnim(a => ({ ...a, traces: a.traces + 1 })), TRACE_DELAY);
      } else {
        tid = setTimeout(() => setAnim({ chars: 0, traces: 0, phase: 'typing' }), LOOP_PAUSE);
      }
    }

    return () => clearTimeout(tid);
  }, [anim, prefersReduced]);

  const displayCode   = prefersReduced ? fullCode : fullCode.slice(0, anim.chars);
  const displayTraces = prefersReduced ? TOTAL_TRACES : anim.traces;
  const showCursor    = !prefersReduced && anim.phase === 'typing';

  return (
    <section className="px-6 pt-24 pb-28">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">

        {/* Left: copy */}
        <div>
          <p
            className="font-mono text-2xs tracking-[0.2em] uppercase mb-5"
            style={{ color: 'var(--text-3)' }}
          >
            {hero.eyebrow}
          </p>
          <h1
            className="text-[28px] md:text-[42px] font-medium leading-tight mb-5"
            style={{ color: 'var(--text)' }}
          >
            {hero.headline}
          </h1>
          <p
            className="text-lg leading-relaxed mb-8 max-w-md"
            style={{ color: 'var(--text-2)' }}
          >
            {hero.subhead}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={hero.ctas.primary.href}
              className="inline-flex items-center px-5 py-2.5 rounded-full text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--brand)' }}
            >
              {hero.ctas.primary.label}
            </a>
            <a
              href={hero.ctas.secondary.href}
              className="inline-flex items-center px-5 py-2.5 rounded-full text-sm font-medium border transition-colors text-text-2 hover:text-text"
              style={{ borderColor: 'var(--border-strong)' }}
            >
              {hero.ctas.secondary.label}
            </a>
          </div>
        </div>

        {/* Right: animation panels — space reserved to prevent CLS */}
        <div className="grid grid-cols-2 gap-3" style={{ minHeight: '300px' }}>

          {/* Code panel */}
          <div
            className="rounded-lg border p-4 overflow-hidden flex flex-col"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <p className="font-mono text-2xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
              SDK
            </p>
            <pre
              className="font-mono leading-relaxed whitespace-pre-wrap flex-1"
              style={{ fontSize: '10px', color: 'var(--text-2)', wordBreak: 'break-word', overflowWrap: 'break-word' }}
            >
              {displayCode}
              {showCursor && (
                <span
                  className="inline-block animate-pulse"
                  style={{
                    width:          '1.5px',
                    height:         '11px',
                    marginLeft:     '1px',
                    background:     'var(--brand)',
                    verticalAlign:  'text-bottom',
                  }}
                />
              )}
            </pre>
          </div>

          {/* Trace panel */}
          <div
            className="rounded-lg border p-4 flex flex-col"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <p className="font-mono text-2xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
              TRACE
            </p>
            <div className="space-y-3 flex-1">
              {heroAnimation.traceLines.slice(0, displayTraces).map((line, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="font-mono mt-[2px] flex-shrink-0" style={{ fontSize: '9px', color: 'var(--text-3)' }}>
                    →
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono truncate" style={{ fontSize: '9px', color: 'var(--text-2)' }}>
                      {line.event}
                    </p>
                    <p className="font-mono truncate" style={{ fontSize: '8px', color: 'var(--text-3)' }}>
                      {line.detail}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0 rounded-full mt-[3px]"
                    style={{
                      width:      '6px',
                      height:     '6px',
                      background: STATUS_COLOR[line.status] ?? 'var(--text-3)',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
