import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { integration } from '../../../content/landing';

export default function Integration() {
  const { ref, visible } = useScrollReveal();
  const steps = integration.flowSteps;

  return (
    <section id="integration" className="px-6 py-24 border-t" style={{ borderColor: 'var(--border)' }}>
      <div
        ref={ref}
        className="max-w-5xl mx-auto transition-all duration-500 ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(20px)' }}
      >
        <p className="font-mono text-2xs tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--text-3)' }}>
          {integration.label}
        </p>
        <h2 className="text-[22px] md:text-[32px] font-medium leading-snug mb-12" style={{ color: 'var(--text)' }}>
          {integration.headline}
        </h2>

        {/* Architecture flow — inline SVG, flat, hairline */}
        <div className="mb-12 overflow-x-auto">
          <svg
            viewBox={`0 0 ${steps.length * 140 - 20} 56`}
            className="w-full max-w-2xl"
            style={{ minWidth: `${steps.length * 120}px`, height: '56px' }}
            aria-label="Architecture flow diagram"
          >
            {steps.map((step, i) => {
              const x = i * 140;
              const isProque = step === 'Progue API';
              return (
                <g key={step}>
                  {/* Box */}
                  <rect
                    x={x}
                    y={8}
                    width={120}
                    height={36}
                    rx={6}
                    fill={isProque ? 'rgba(91,58,130,0.12)' : 'var(--surface)'}
                    stroke={isProque ? 'var(--brand)' : 'var(--border)'}
                    strokeWidth={1}
                  />
                  {/* Label */}
                  <text
                    x={x + 60}
                    y={30}
                    textAnchor="middle"
                    fontSize={10}
                    fontFamily="'Geist', system-ui, sans-serif"
                    fill={isProque ? 'var(--brand)' : 'var(--text-2)'}
                  >
                    {step}
                  </text>
                  {/* Arrow to next */}
                  {i < steps.length - 1 && (
                    <path
                      d={`M ${x + 122} 26 L ${x + 138} 26`}
                      stroke="var(--text-3)"
                      strokeWidth={1}
                      markerEnd="url(#arrowhead)"
                    />
                  )}
                </g>
              );
            })}
            <defs>
              <marker id="arrowhead" markerWidth={6} markerHeight={6} refX={3} refY={3} orient="auto">
                <path d="M0,0 L0,6 L6,3 Z" fill="var(--text-3)" />
              </marker>
            </defs>
          </svg>
        </div>

        {/* Code block */}
        <div
          className="rounded-lg border p-6 overflow-x-auto"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <pre
            className="font-mono leading-relaxed"
            style={{ fontSize: '12px', color: 'var(--text-2)', whiteSpace: 'pre' }}
          >
            {integration.codeBlock}
          </pre>
        </div>
      </div>
    </section>
  );
}
