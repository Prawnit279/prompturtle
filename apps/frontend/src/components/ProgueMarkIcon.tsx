/**
 * Progue network mark — matches the Favicon spec design.
 *
 * Static (depth & bloom):  <ProgueMarkIcon glow />
 * Animated (bloom+orbital): <ProgueMarkIcon glow animate="spin" />
 * Minimal (16px favicon):  <ProgueMarkIcon density="minimal" />
 */

interface ProgueMarkIconProps {
  /** Enable radial bloom glow behind the mark */
  glow?: boolean;
  /** Animation mode — 'spin' counter-rotates rings vs web */
  animate?: 'none' | 'spin';
  /** Node/edge density — shed detail at small sizes */
  density?: 'full' | 'medium' | 'minimal';
  /** Ring stroke width (default 1.4) */
  ringW?: number;
  /** Primary accent color (default rose #C44E5F) */
  accent?: string;
  /** Light accent for gradients (default #E69AA3) */
  accentLight?: string;
  className?: string;
  style?: React.CSSProperties;
}

const ACCENT = '#C44E5F';

// Perimeter nodes: 8 points at radius 50 from center, starting top (-90°), every 45°
const PERIM = Array.from({ length: 8 }, (_, i) => {
  const a = (-90 + i * 45) * (Math.PI / 180);
  return { x: +(100 + 50 * Math.cos(a)).toFixed(2), y: +(100 + 50 * Math.sin(a)).toFixed(2) };
});
const CX = 100, CY = 100;

function buildEdges(density: 'full' | 'medium' | 'minimal') {
  const edges: { x1: number; y1: number; x2: number; y2: number; w: number }[] = [];

  // Center spokes
  PERIM.forEach(pt => edges.push({ x1: CX, y1: CY, x2: pt.x, y2: pt.y, w: 1.3 }));

  // Perimeter octagon
  for (let i = 0; i < 8; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const a = PERIM[i]!, b = PERIM[(i + 1) % 8]!;
    edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, w: 1.3 });
  }

  if (density === 'medium' || density === 'full') {
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const a = PERIM[i]!, b = PERIM[(i + 2) % 8]!;
      edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, w: 1.0 });
    }
  }

  if (density === 'full') {
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const a = PERIM[i]!, b = PERIM[(i + 3) % 8]!;
      edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, w: 1.0 });
    }
  }

  return edges;
}

export default function ProgueMarkIcon({
  glow = false,
  animate = 'none',
  density = 'full',
  ringW = 1.4,
  accent = ACCENT,
  accentLight = '#E69AA3',
  className,
  style,
}: ProgueMarkIconProps) {
  const edges = buildEdges(density);
  const centerR = density === 'minimal' ? 7 : 6;
  const nodeR = density === 'minimal' ? 5 : 4.2;
  void accentLight; // available for future gradient use

  const isSpin = animate === 'spin';
  const ringStyle = isSpin ? { transformBox: 'fill-box' as const, transformOrigin: 'center', animation: 'mk-spin 40s linear infinite' } : undefined;
  const webStyle = isSpin ? { transformBox: 'fill-box' as const, transformOrigin: 'center', animation: 'mk-spin-rev 60s linear infinite' } : undefined;

  return (
    <>
      <style>{`
        @keyframes mk-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes mk-spin-rev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
      `}</style>
      <svg
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible', ...style }}
        aria-label="Progue"
        role="img"
      >
        <defs>
          <radialGradient id="mk-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
            <stop offset="55%" stopColor={accent} stopOpacity="0.12" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        {glow && <circle cx={CX} cy={CY} r={86} fill="url(#mk-glow)" />}

        <g style={ringStyle}>
          <circle cx={CX} cy={CY} r={84} fill="none" stroke={accent} strokeWidth={ringW} opacity={0.9} />
          <circle cx={CX} cy={CY} r={76} fill="none" stroke={accent} strokeWidth={ringW} opacity={0.7} />
        </g>

        <g style={webStyle}>
          {edges.map((e, i) => (
            <line
              key={i}
              x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke={accent} strokeWidth={e.w} strokeLinecap="round"
            />
          ))}
          <circle cx={CX} cy={CY} r={centerR} fill={accent} />
          {PERIM.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r={nodeR} fill={accent} />
          ))}
        </g>
      </svg>
    </>
  );
}
