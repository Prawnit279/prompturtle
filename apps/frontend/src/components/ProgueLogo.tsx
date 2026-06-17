import ProgueMarkIcon from './ProgueMarkIcon';

/**
 * Progue primary wordmark — design spec: "One word, one line".
 *
 * The Mark glyph nests between the 'r' and 'g'. A rose line runs through the
 * optical centre of the letters with end-dot nodes at each overhang. Letters
 * are lifted so their centres align with the line.
 *
 * Usage:
 *   <ProgueLogo height={32} />                  // nav (dark)
 *   <ProgueLogo height={64} variant="light" />  // light / print context
 */

interface PragueLogogProps {
  /** Total height of the lockup in px (default 64) */
  height?: number;
  /** dark = navy context (#F4F2F5 text, #C44E5F line)
   *  light = warm-paper context (#1A1320 text, #9E3346 line) */
  variant?: 'dark' | 'light';
  className?: string;
  style?: React.CSSProperties;
}

// Reference measurements from the design spec at height=64 (small proof)
const REF_H         = 64;
const REF_FONT      = 44;
const REF_GLYPH     = 50;
const REF_MARGIN    = 13;   // negative inline margin pulling glyph into letters
const REF_OVERHANG  = 16;   // line extension beyond letter group each side
const REF_DOT       = 7;
const REF_LIFT      = 4;    // translateY lift applied to letters (up)
const REF_LINE_H    = 1.2;

function scale(ref: number, h: number) {
  return (ref / REF_H) * h;
}

export default function ProgueLogo({
  height = 64,
  variant = 'dark',
  className,
  style,
}: PragueLogogProps) {
  const isDark = variant === 'dark';

  const textColor  = isDark ? '#F4F2F5' : '#1A1320';
  const lineColor  = isDark ? '#C44E5F' : '#9E3346';
  const markAccent = isDark ? '#C44E5F' : '#9E3346';
  const markAccentLight = isDark ? '#E69AA3' : '#C44E5F';

  const fontSize   = scale(REF_FONT,     height);
  const glyphSize  = scale(REF_GLYPH,    height);
  const glyphMar   = scale(REF_MARGIN,   height);
  const overhang   = scale(REF_OVERHANG, height);
  const dotSize    = scale(REF_DOT,      height);
  const lift       = scale(REF_LIFT,     height);
  const lineThick  = Math.max(1, scale(REF_LINE_H, height));

  return (
    <span
      className={className}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        height: `${height}px`,
        padding: '0 4px',
        ...style,
      }}
      aria-label="Progue"
      role="img"
    >
      {/* horizontal line */}
      <span style={{
        position: 'absolute',
        left: `-${overhang}px`,
        right: `-${overhang}px`,
        top: '50%',
        height: `${lineThick}px`,
        background: lineColor,
        opacity: isDark ? 0.9 : 1,
        transform: 'translateY(-50%)',
      }} />

      {/* left end-dot */}
      <span style={{
        position: 'absolute',
        left: `-${overhang}px`,
        top: '50%',
        width: `${dotSize}px`,
        height: `${dotSize}px`,
        borderRadius: '50%',
        background: lineColor,
        transform: 'translate(-50%, -50%)',
      }} />

      {/* right end-dot */}
      <span style={{
        position: 'absolute',
        right: `-${overhang}px`,
        top: '50%',
        width: `${dotSize}px`,
        height: `${dotSize}px`,
        borderRadius: '50%',
        background: lineColor,
        transform: 'translate(50%, -50%)',
      }} />

      {/* letterforms + glyph row */}
      <span style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: `${fontSize}px`,
        fontFamily: "'Jost', sans-serif",
        fontWeight: 300,
        color: textColor,
        letterSpacing: '-0.05em',
        lineHeight: 1,
      }}>
        <span style={{ transform: `translateY(-${lift}px)` }}>p</span>
        <span style={{ transform: `translateY(-${lift}px)` }}>r</span>
        <span style={{
          display: 'inline-block',
          width: `${glyphSize}px`,
          height: `${glyphSize}px`,
          margin: `0 -${glyphMar}px`,
          flexShrink: 0,
        }}>
          <ProgueMarkIcon accent={markAccent} accentLight={markAccentLight} />
        </span>
        <span style={{ transform: `translateY(-${lift}px)` }}>gue</span>
      </span>
    </span>
  );
}
