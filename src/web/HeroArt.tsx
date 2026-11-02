import { Check, Sun } from 'lucide-react';

const SEAT_ROWS = [-38, -22, -6, 10, 26, 42];
const WINDOWS = [-42, -25, -8, 9, 26, 43];

/**
 * A map-like scene: a bus heading north-east in the morning, the sun beaming onto its right
 * windows while the left side sits in shade, with the answer floating beside it.
 */
export function HeroArt({ className = '' }: { className?: string }) {
  return (
    <figure className={`relative mx-auto w-full max-w-[34rem] ${className}`}>
      <svg viewBox="0 0 520 460" className="block h-auto w-full" role="img" aria-label="A bus heading north-east with the morning sun on its right side">
        <defs>
          <linearGradient id="hero-sky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--color-surface)' }} />
            <stop offset="1" style={{ stopColor: 'var(--color-brand-soft)' }} />
          </linearGradient>
          <linearGradient id="hero-beam" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--color-brand)', stopOpacity: 0.45 }} />
            <stop offset="1" style={{ stopColor: 'var(--color-brand)', stopOpacity: 0.06 }} />
          </linearGradient>
          <filter id="hero-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <clipPath id="hero-card">
            <rect width="520" height="460" rx="32" />
          </clipPath>
        </defs>

        <g clipPath="url(#hero-card)">
          <rect width="520" height="460" fill="url(#hero-sky)" />
          {/* faint map grid */}
          <g className="stroke-hairline" strokeWidth="1">
            {Array.from({ length: 10 }, (_, i) => (
              <line key={`v${i}`} x1={i * 52 + 26} y1="0" x2={i * 52 + 26} y2="460" />
            ))}
            {Array.from({ length: 9 }, (_, i) => (
              <line key={`h${i}`} x1="0" y1={i * 52 + 22} x2="520" y2={i * 52 + 22} />
            ))}
          </g>

          {/* the road, with a dashed centre line */}
          <path d="M-30 440 C110 410 140 300 230 260 S380 170 420 80 S470 0 560 -30" fill="none" strokeWidth="58" strokeLinecap="round" className="stroke-axis" />
          <path d="M-30 440 C110 410 140 300 230 260 S380 170 420 80 S470 0 560 -30" fill="none" strokeWidth="50" strokeLinecap="round" className="stroke-hairline" />
          <path
            d="M-30 440 C110 410 140 300 230 260 S380 170 420 80 S470 0 560 -30"
            fill="none"
            strokeWidth="3"
            strokeDasharray="14 12"
            className="stroke-surface"
          />
          <circle cx="62" cy="402" r="9" strokeWidth="3" className="fill-ink stroke-surface" />
          <circle cx="438" cy="52" r="9" strokeWidth="4" className="fill-surface stroke-ink" />

          {/* the sun, low in the south-east */}
          <g className="origin-center [transform-box:fill-box] motion-safe:animate-spin-slow">
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i * Math.PI) / 6;
              return (
                <line
                  key={i}
                  x1={340 + Math.cos(a) * 38}
                  y1={398 + Math.sin(a) * 38}
                  x2={340 + Math.cos(a) * 52}
                  y2={398 + Math.sin(a) * 52}
                  strokeWidth="5"
                  strokeLinecap="round"
                  className="stroke-brand"
                />
              );
            })}
          </g>
          <circle cx="340" cy="398" r="28" className="fill-brand" />

          {/* the bus, nose up in its own frame, turned to follow the road (heading about 66°) */}
          <g transform="translate(230 260) rotate(66)">
            {/* light fanning from the sun (at about 171,-44 in the bus's frame) onto the right side */}
            <polygon points="171,-44 31,-60 31,60" fill="url(#hero-beam)" />
            <rect x="-42" y="-58" width="60" height="128" rx="14" className="fill-ink" opacity="0.14" filter="url(#hero-blur)" />
            <rect x="-30" y="-64" width="60" height="128" rx="14" strokeWidth="2.5" className="fill-surface stroke-ink-2" />
            <path d="M-21 -55 Q0 -63 21 -55 L21 -49 Q0 -55 -21 -49 Z" className="fill-ink-2" opacity="0.35" />
            {WINDOWS.map((y) => (
              <g key={y}>
                <rect x="-31.5" y={y} width="4" height="12" rx="1.5" className="fill-axis" />
                <rect x="27.5" y={y} width="4" height="12" rx="1.5" className="fill-brand" />
              </g>
            ))}
            {SEAT_ROWS.map((y) => (
              <g key={y}>
                <rect x="-22" y={y} width="9" height="11" rx="2.5" className="fill-ink" />
                <rect x="-11" y={y} width="9" height="11" rx="2.5" className="fill-ink" />
                <rect x="2" y={y} width="9" height="11" rx="2.5" strokeWidth="1.5" className="fill-brand-soft stroke-brand" />
                <rect x="13" y={y} width="9" height="11" rx="2.5" strokeWidth="1.5" className="fill-brand-soft stroke-brand" />
              </g>
            ))}
          </g>

          {/* compass */}
          <g className="fill-muted">
            <path d="M486 30 l6 14 h-12 z" />
            <text x="486" y="60" textAnchor="middle" className="text-[11px] font-semibold">
              N
            </text>
          </g>
        </g>
        <rect width="520" height="460" rx="32" fill="none" strokeWidth="1" className="stroke-hairline" />
      </svg>

      {/* the answer, floating over the map */}
      <figcaption className="pointer-events-none absolute top-[9%] left-[5%] rounded-2xl bg-surface/95 px-4 py-3 shadow-lg ring-1 ring-ink/5 backdrop-blur">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-5 place-items-center rounded-full bg-good text-white">
            <Check aria-hidden className="size-3.5" strokeWidth={3} />
          </span>
          Sit on the left
        </span>
        <span className="mt-0.5 block text-xs text-ink-2">Ahmedabad → Himatnagar · 09:00</span>
      </figcaption>
      <div className="pointer-events-none absolute right-[5%] bottom-[25%] flex items-center gap-2 rounded-2xl bg-surface/95 px-3.5 py-2.5 text-xs shadow-lg ring-1 ring-ink/5 backdrop-blur">
        <Sun aria-hidden className="size-4 text-brand" />
        <span>
          <span className="font-semibold">2h 00m</span> <span className="text-ink-2">of sun on the right</span>
        </span>
      </div>
    </figure>
  );
}
