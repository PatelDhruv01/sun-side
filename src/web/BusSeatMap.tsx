import type { Decision, SeatSide } from '../engine/decide.ts';

const ROWS = Array.from({ length: 9 }, (_, i) => 84 + i * 18);
/** Seat columns: left window, left aisle, right aisle, right window. */
const COLUMNS: [SeatSide, number][] = [
  ['left', 58],
  ['left', 73],
  ['right', 95],
  ['right', 110],
];

interface Props {
  sit: Decision['sit'];
  /** The side the sun is on, if it's on one. */
  sunny?: SeatSide;
  avoidRows?: Decision['avoidRows'];
  className?: string;
}

/**
 * A 2+2 bus from above, nose up (the driver on the right, as in India). The seats to take are
 * filled in, the sunny side's windows glow with light beaming in, and rows to avoid are dashed.
 */
export function BusSeatMap({ sit, sunny, avoidRows, className = '' }: Props) {
  const avoided = (row: number) => (avoidRows === 'front' && row < 2) || (avoidRows === 'back' && row >= ROWS.length - 2);
  const label =
    sit === 'either' ? 'Seat map: any seat is fine.' : `Seat map: sit on the ${sit}${sunny ? `; the sun is on the ${sunny}` : ''}.`;
  const right = sunny === 'right';
  return (
    <svg viewBox="0 0 180 270" className={className} role="img" aria-label={label}>
      <defs>
        <linearGradient id="seat-beam" x1={right ? '1' : '0'} y1="0" x2={right ? '0' : '1'} y2="0">
          <stop offset="0" style={{ stopColor: 'var(--color-brand)', stopOpacity: 0.4 }} />
          <stop offset="1" style={{ stopColor: 'var(--color-brand)', stopOpacity: 0.04 }} />
        </linearGradient>
      </defs>

      {sunny && (
        <g>
          <polygon points={right ? '131,80 131,244 178,226 178,98' : '49,80 49,244 2,226 2,98'} fill="url(#seat-beam)" className="motion-safe:animate-glow" />
          <g className="origin-center stroke-brand [transform-box:fill-box] motion-safe:animate-spin-slow" strokeWidth="2.5" strokeLinecap="round">
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              const cx = right ? 160 : 20;
              return <line key={i} x1={cx + Math.cos(a) * 12} y1={50 + Math.sin(a) * 12} x2={cx + Math.cos(a) * 17} y2={50 + Math.sin(a) * 17} />;
            })}
          </g>
          <circle cx={right ? 160 : 20} cy="50" r="8" className="fill-brand" />
        </g>
      )}

      <path d="M90 4 l7 10 h-14 z" className="fill-muted" />
      <rect x="50" y="22" width="80" height="236" rx="20" strokeWidth="2.5" className="fill-surface stroke-ink-2" />
      <path d="M61 37 Q90 27 119 37 L119 46 Q90 38 61 46 Z" className="fill-ink-2" opacity="0.3" />
      {/* the driver's wheel, front right */}
      <circle cx="114" cy="62" r="6.5" strokeWidth="2" className="fill-none stroke-ink-2" />

      {ROWS.map((y) => (
        <g key={`w${y}`}>
          <rect x="47.5" y={y} width="5" height="13" rx="2" className={sunny === 'left' ? 'fill-brand' : 'fill-axis'} />
          <rect x="127.5" y={y} width="5" height="13" rx="2" className={sunny === 'right' ? 'fill-brand' : 'fill-axis'} />
        </g>
      ))}

      {ROWS.map((y, row) =>
        COLUMNS.map(([side, x]) => {
          const take = sit === side && !avoided(row);
          const hot = sunny === side;
          return (
            <rect
              key={`${row}-${x}`}
              x={x}
              y={y}
              width="12"
              height="13"
              rx="3"
              strokeWidth="1.5"
              strokeDasharray={sit === side && avoided(row) ? '2.5 2' : undefined}
              className={take ? 'fill-ink stroke-ink' : hot ? 'fill-brand-soft stroke-brand' : 'fill-none stroke-axis'}
            />
          );
        }),
      )}

      {sit !== 'either' && (
        <g transform={`translate(${sit === 'left' ? 28 : 152} 165)`}>
          {/* the pop scales this inner group, leaving the placement above alone */}
          <g className="origin-center animate-pop [transform-box:fill-box]" style={{ animationDelay: '450ms' }}>
            <circle r="11" className="fill-good" />
            <path d="M-5 0.5 l3.5 3.5 l6.5 -7" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      )}

      <g className="fill-muted text-[10px] font-semibold tracking-wider">
        <text x="72" y="268" textAnchor="middle">
          LEFT
        </text>
        <text x="108" y="268" textAnchor="middle">
          RIGHT
        </text>
      </g>
    </svg>
  );
}
