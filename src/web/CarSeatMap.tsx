import type { Decision, SeatSide } from '../engine/decide.ts';

/** Seats as [side, row, x, y, width, height]; the middle back seat has no window, so no side. */
const SEATS: [SeatSide | 'middle' | 'driver', 'front' | 'back', number, number, number, number][] = [
  ['left', 'front', 62, 118, 22, 26],
  ['driver', 'front', 96, 118, 22, 26],
  ['left', 'back', 60, 160, 18, 28],
  ['middle', 'back', 81, 160, 18, 28],
  ['right', 'back', 102, 160, 18, 28],
];
/** Side windows, front and back, as [y, height]. */
const WINDOWS: [number, number][] = [
  [110, 34],
  [152, 40],
];

interface Props {
  sit: Decision['sit'];
  /** The side the sun is on, if it's on one. */
  sunny?: SeatSide;
  avoidRows?: Decision['avoidRows'];
  className?: string;
}

/**
 * A car from above, nose up, with the driver on the right as in India. The driver can't move,
 * so "sit on the left" means the front passenger seat or the one behind it, and "sit on the
 * right" means the back seat behind the driver. Same look as the bus seat map.
 */
export function CarSeatMap({ sit, sunny, avoidRows, className = '' }: Props) {
  const label =
    sit === 'either'
      ? 'Seat map of a car: any seat is fine.'
      : `Seat map of a car: sit on the ${sit}, ${sit === 'left' ? 'in the front passenger seat or behind it' : 'in the back seat behind the driver'}${sunny ? `; the sun is on the ${sunny}` : ''}.`;
  const right = sunny === 'right';
  return (
    <svg viewBox="0 0 180 270" className={className} role="img" aria-label={label}>
      <defs>
        <linearGradient id="car-beam" x1={right ? '1' : '0'} y1="0" x2={right ? '0' : '1'} y2="0">
          <stop offset="0" style={{ stopColor: 'var(--color-brand)', stopOpacity: 0.4 }} />
          <stop offset="1" style={{ stopColor: 'var(--color-brand)', stopOpacity: 0.04 }} />
        </linearGradient>
      </defs>

      {sunny && (
        <g>
          <polygon points={right ? '131,104 131,200 178,188 178,116' : '49,104 49,200 2,188 2,116'} fill="url(#car-beam)" className="motion-safe:animate-glow" />
          <g className="origin-center stroke-brand [transform-box:fill-box] motion-safe:animate-spin-slow" strokeWidth="2.5" strokeLinecap="round">
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              const cx = right ? 160 : 20;
              return <line key={i} x1={cx + Math.cos(a) * 12} y1={62 + Math.sin(a) * 12} x2={cx + Math.cos(a) * 17} y2={62 + Math.sin(a) * 17} />;
            })}
          </g>
          <circle cx={right ? 160 : 20} cy="62" r="8" className="fill-brand" />
        </g>
      )}

      <path d="M90 8 l7 10 h-14 z" className="fill-muted" />
      {/* wheels and mirrors, tucked behind the body */}
      <g className="fill-ink-2" opacity="0.55">
        {[58, 184].map((y) => (
          <g key={y}>
            <rect x="44" y={y} width="10" height="32" rx="3" />
            <rect x="126" y={y} width="10" height="32" rx="3" />
          </g>
        ))}
      </g>
      <rect x="40" y="100" width="12" height="7" rx="3" strokeWidth="2" className="fill-surface stroke-ink-2" />
      <rect x="128" y="100" width="12" height="7" rx="3" strokeWidth="2" className="fill-surface stroke-ink-2" />
      <rect x="50" y="30" width="80" height="212" rx="30" strokeWidth="2.5" className="fill-surface stroke-ink-2" />
      {/* windscreen and rear window */}
      <path d="M62 82 Q90 72 118 82 L114 100 Q90 94 66 100 Z" className="fill-ink-2" opacity="0.3" />
      <path d="M66 214 Q90 219 114 214 L118 228 Q90 236 62 228 Z" className="fill-ink-2" opacity="0.3" />
      {/* the driver's wheel, front right */}
      <circle cx="107" cy="110" r="6" strokeWidth="2" className="fill-none stroke-ink-2" />

      {WINDOWS.map(([y, height]) => (
        <g key={y}>
          <rect x="47.5" y={y} width="5" height={height} rx="2" className={sunny === 'left' ? 'fill-brand' : 'fill-axis'} />
          <rect x="127.5" y={y} width="5" height={height} rx="2" className={sunny === 'right' ? 'fill-brand' : 'fill-axis'} />
        </g>
      ))}

      {SEATS.map(([side, row, x, y, width, height]) => {
        const avoided = avoidRows === row;
        const className =
          side === 'driver'
            ? 'fill-axis stroke-axis' // taken: the driver isn't moving
            : side === 'middle'
              ? 'fill-none stroke-axis'
              : sit === side && !avoided
                ? 'fill-ink stroke-ink'
                : sunny === side
                  ? 'fill-brand-soft stroke-brand'
                  : 'fill-none stroke-axis';
        return (
          <rect
            key={`${side}-${row}`}
            x={x}
            y={y}
            width={width}
            height={height}
            rx="4"
            strokeWidth="1.5"
            strokeDasharray={sit === side && avoided ? '2.5 2' : undefined}
            className={className}
          />
        );
      })}

      {sit !== 'either' && (
        <g transform={`translate(${sit === 'left' ? 28 : 152} 152)`}>
          {/* the pop scales this inner group, leaving the placement above alone */}
          <g className="origin-center animate-pop [transform-box:fill-box]" style={{ animationDelay: '450ms' }}>
            <circle r="11" className="fill-good" />
            <path d="M-5 0.5 l3.5 3.5 l6.5 -7" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      )}

      <g className="fill-muted text-[10px] font-semibold tracking-wider">
        <text x="72" y="264" textAnchor="middle">
          LEFT
        </text>
        <text x="108" y="264" textAnchor="middle">
          RIGHT
        </text>
      </g>
    </svg>
  );
}
