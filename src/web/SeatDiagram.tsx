import type { Decision, SeatSide } from '../engine/decide.ts';

const ROWS = [38, 54, 70, 86, 102];

/** A bus seen from above, nose up: the seats to take filled in, and the sun on the side to avoid. */
export function SeatDiagram({ sit, sunny }: { sit: Decision['sit']; sunny?: SeatSide }) {
  const label = sit === 'either' ? 'Either side is fine' : `Sit on the ${sit}${sunny ? `; the sun is on the ${sunny}` : ''}`;
  const seat = (side: SeatSide, y: number) => (
    <rect
      key={`${side}-${y}`}
      x={side === 'left' ? 34 : 52}
      y={y}
      width="10"
      height="11"
      rx="2.5"
      strokeWidth="1.5"
      className={sit === side ? 'fill-ink stroke-ink' : 'fill-none stroke-axis'}
    />
  );
  return (
    <svg viewBox="0 0 96 128" className="h-24 w-16 shrink-0 sm:h-28 sm:w-20" role="img" aria-label={label}>
      <path d="M48 1 l6 8 h-12 z" className="fill-muted" />
      <rect x="27" y="12" width="42" height="112" rx="10" strokeWidth="2" className="fill-surface stroke-ink-2" />
      <path d="M34 21 q14 -6 28 0" strokeWidth="2" strokeLinecap="round" className="fill-none stroke-ink-2" />
      {ROWS.map((y) => seat('left', y))}
      {ROWS.map((y) => seat('right', y))}
      {sunny && <Sun cx={sunny === 'left' ? 12 : 84} cy={72} className={sunny === 'left' ? 'stroke-sun-left' : 'stroke-sun-right'} />}
    </svg>
  );
}

function Sun({ cx, cy, className }: { cx: number; cy: number; className: string }) {
  return (
    <g className={className} strokeWidth="2" strokeLinecap="round">
      <circle cx={cx} cy={cy} r="4.5" className="fill-none" />
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i * Math.PI) / 4;
        return <line key={i} x1={cx + Math.cos(angle) * 7.5} y1={cy + Math.sin(angle) * 7.5} x2={cx + Math.cos(angle) * 10.5} y2={cy + Math.sin(angle) * 10.5} />;
      })}
    </g>
  );
}
