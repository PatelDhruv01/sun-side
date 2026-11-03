import { Check, Clock } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { reducedMotion, useInView } from './hooks.ts';
import { shortDuration } from './time.ts';

/** A ghat road in three legs on a 520 × 400 map: east-north-east, back west, east-north-east again. */
const ROAD = 'M10 375 C140 350 290 320 360 298 C430 276 440 228 380 222 C320 216 200 218 150 205 C100 192 100 140 160 134 C250 125 360 90 430 58 C470 40 500 22 560 0';
/** Towards the sun on screen: a morning sun in the south-east. It's far away, so its light comes in parallel. */
const LIGHT = [Math.SQRT1_2, Math.SQRT1_2] as const;
/** The stretch of the road the trip drives, as shares of its length. */
const TRIP = { from: 0.035, to: 0.86 };
const SAMPLES = 360;
const TRAVEL = 14_000; // ms to drive it
const HOLD = 3_400; // ms on the answer before it starts again
const START = 9 * 60; // leaves at 09:00
const MINUTES = 120;
/** How square-on the sun has to be (the sine of its angle off the nose) to count for a side. */
const SIDE = 0.35;
const SEAT_ROWS = [-38, -22, -6, 10, 26, 42];
const WINDOWS = [-42, -25, -8, 9, 26, 43];
const TREES: [number, number, number][] = [
  [46, 236, 9], [64, 250, 7], [38, 258, 6], [238, 268, 8], [256, 278, 6], [300, 160, 8], [318, 170, 6], [470, 128, 9], [488, 142, 7], [456, 150, 6],
];
const HOUSES: [number, number, number, number][] = [
  [352, 16, 14, 10], [370, 24, 10, 12], [386, 12, 12, 9], [470, 76, 12, 9], [486, 86, 9, 11],
];

/** One point along the drive: where the bus is, which way it faces, the light in its own frame, and the sun so far. */
interface Sample {
  x: number;
  y: number;
  /** Degrees clockwise from straight up the screen. */
  angle: number;
  /** Towards the sun in the bus's frame: x to its right, y to its tail. */
  lx: number;
  ly: number;
  /** Minutes of sun through each side up to here. */
  left: number;
  right: number;
}

interface Readout {
  minute: number;
  /** The side the sun is on right now, or where it is if it's on neither. */
  now: 'left' | 'right' | 'ahead' | 'behind';
  left: number;
  right: number;
  done: boolean;
}

/**
 * The start page's demo: a bus drives a winding road under a morning sun. The light swings from
 * one side to the other at every bend, while it adds up the sun through each side, minute by
 * minute, and ends on the side to sit. With reduced motion it's a still picture with the answer.
 */
export function HeroArt({ className = '' }: { className?: string }) {
  const figure = useRef<HTMLElement>(null);
  const road = useRef<SVGPathElement>(null);
  const bus = useRef<SVGGElement>(null);
  const beam = useRef<SVGPolygonElement>(null);
  const fade = useRef<SVGLinearGradientElement>(null);
  const shadow = useRef<SVGRectElement>(null);
  const samples = useRef<Sample[]>([]);
  const elapsed = useRef(0);
  const [ends, setEnds] = useState<[Sample, Sample] | null>(null);
  const [readout, setReadout] = useState<Readout>({ minute: 0, now: 'right', left: 0, right: 0, done: false });
  const inView = useInView(figure);

  useLayoutEffect(() => {
    samples.current = sampleRoad(road.current!);
    setEnds([samples.current[0], samples.current[samples.current.length - 1]]);
  }, []);

  useEffect(() => {
    const all = samples.current;
    if (all.length === 0) return;

    /** The bus `f` of the way along, faded in or out by `opacity`. */
    const show = (f: number, done: boolean, opacity = 1) => {
      const at = Math.max(0, Math.min(1, f)) * (all.length - 1);
      const i = Math.floor(at);
      const a = all[i];
      const b = all[Math.min(all.length - 1, i + 1)];
      const u = at - i;
      const mix = (p: number, q: number) => p + (q - p) * u;
      const turn = ((b.angle - a.angle + 540) % 360) - 180;
      const [lx, ly] = [mix(a.lx, b.lx), mix(a.ly, b.ly)];
      bus.current?.setAttribute('transform', `translate(${mix(a.x, b.x).toFixed(1)} ${mix(a.y, b.y).toFixed(1)}) rotate(${(a.angle + turn * u).toFixed(1)}) scale(0.62)`);
      if (bus.current) bus.current.style.opacity = String(opacity);

      // The light falling on the sunny side, as a band from its windows back towards the sun.
      const side = lx >= 0 ? 1 : -1;
      const reach = 112;
      const edge = side * 31;
      const [fx, fy] = [lx * reach, ly * reach];
      beam.current?.setAttribute('points', `${edge},-50 ${edge + fx},${-50 + fy} ${edge + fx},${52 + fy} ${edge},52`);
      if (beam.current) beam.current.style.opacity = String(Math.max(0, Math.min(1, (Math.abs(lx) - 0.1) / 0.5)));
      fade.current?.setAttribute('x1', String(edge));
      fade.current?.setAttribute('x2', String(edge + fx));
      fade.current?.setAttribute('y2', String(fy));
      shadow.current?.setAttribute('transform', `translate(${(-lx * 9).toFixed(1)} ${(-ly * 9).toFixed(1)})`);

      const here = all[Math.round(at)];
      const tally = done ? all[all.length - 1] : here;
      const next: Readout = {
        minute: Math.round(f * MINUTES),
        now: Math.abs(here.lx) > SIDE ? (here.lx > 0 ? 'right' : 'left') : here.ly > 0 ? 'behind' : 'ahead',
        left: Math.round(tally.left),
        right: Math.round(tally.right),
        done,
      };
      setReadout((last) =>
        last.minute === next.minute && last.now === next.now && last.left === next.left && last.right === next.right && last.done === next.done ? last : next,
      );
    };

    if (reducedMotion()) {
      show(0.28, true);
      return;
    }
    if (!inView) return; // rest while it's scrolled away
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A frame's time can be a touch before the effect ran; long gaps (a hidden tab) count as one frame.
      elapsed.current = (elapsed.current + Math.max(0, Math.min(now - last, 100))) % (TRAVEL + HOLD);
      last = now;
      const t = elapsed.current;
      show(Math.min(1, t / TRAVEL), t >= TRAVEL, Math.min(1, t / 350, (TRAVEL + HOLD - t) / 350));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView]);

  const sunny = readout.now === 'left' || readout.now === 'right' ? readout.now : null;
  const sit = readout.right >= readout.left ? 'left' : 'right';
  const clock = `${String(Math.floor((START + readout.minute) / 60)).padStart(2, '0')}:${String((START + readout.minute) % 60).padStart(2, '0')}`;

  return (
    <figure ref={figure} className={`relative mx-auto w-full max-w-[34rem] ${className}`}>
      <div className="overflow-hidden rounded-[2rem] bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_24px_60px_-28px_rgb(0_0_0/0.35)] ring-1 ring-ink/[0.06]">
        <div className="relative">
          <svg viewBox="0 0 520 400" className="block h-auto w-full" aria-hidden>
            <defs>
              <linearGradient id="hero-sky" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" style={{ stopColor: 'var(--color-surface)' }} />
                <stop offset="1" style={{ stopColor: 'var(--color-brand-soft)' }} />
              </linearGradient>
              <radialGradient id="hero-glow">
                <stop offset="0" style={{ stopColor: 'var(--color-brand)', stopOpacity: 0.35 }} />
                <stop offset="1" style={{ stopColor: 'var(--color-brand)', stopOpacity: 0 }} />
              </radialGradient>
              <linearGradient ref={fade} id="hero-beam" gradientUnits="userSpaceOnUse" x1="31" y1="0" x2="110" y2="0">
                <stop offset="0" style={{ stopColor: 'var(--color-brand)', stopOpacity: 0.55 }} />
                <stop offset="1" style={{ stopColor: 'var(--color-brand)', stopOpacity: 0 }} />
              </linearGradient>
              <filter id="hero-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>

            <rect width="520" height="400" fill="url(#hero-sky)" />
            {/* a faint map grid, trees and a few houses */}
            <g className="stroke-hairline" strokeWidth="1">
              {Array.from({ length: 10 }, (_, i) => (
                <line key={`v${i}`} x1={i * 52 + 26} y1="0" x2={i * 52 + 26} y2="400" />
              ))}
              {Array.from({ length: 8 }, (_, i) => (
                <line key={`h${i}`} x1="0" y1={i * 52 + 18} x2="520" y2={i * 52 + 18} />
              ))}
            </g>
            <g className="fill-sun-ends" opacity="0.22">
              {TREES.map(([x, y, r]) => (
                <circle key={`${x},${y}`} cx={x} cy={y} r={r} />
              ))}
            </g>
            <g className="fill-axis" opacity="0.7">
              {HOUSES.map(([x, y, w, h]) => (
                <rect key={`${x},${y}`} x={x} y={y} width={w} height={h} rx="2" />
              ))}
            </g>

            {/* the road, with a dashed centre line */}
            <path d={ROAD} fill="none" strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" className="stroke-axis" />
            <path ref={road} d={ROAD} fill="none" strokeWidth="45" strokeLinecap="round" strokeLinejoin="round" className="stroke-hairline" />
            <path d={ROAD} fill="none" strokeWidth="2.5" strokeDasharray="12 11" className="stroke-surface" />
            {ends && (
              <>
                <circle cx={ends[0].x} cy={ends[0].y} r="8" strokeWidth="3" className="fill-ink stroke-surface" />
                <circle cx={ends[1].x} cy={ends[1].y} r="8" strokeWidth="3.5" className="fill-surface stroke-ink" />
              </>
            )}

            {/* the sun, low in the south-east */}
            <circle cx="452" cy="346" r="78" fill="url(#hero-glow)" className="motion-safe:animate-glow" />
            <g className="origin-center [transform-box:fill-box] motion-safe:animate-spin-slow">
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i * Math.PI) / 6;
                return (
                  <line
                    key={i}
                    x1={452 + Math.cos(a) * 33}
                    y1={346 + Math.sin(a) * 33}
                    x2={452 + Math.cos(a) * 45}
                    y2={346 + Math.sin(a) * 45}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    className="stroke-brand"
                  />
                );
              })}
            </g>
            <circle cx="452" cy="346" r="24" className="fill-brand" />

            {/* compass */}
            <g className="fill-muted">
              <path d="M494 178 l6 14 h-12 z" />
              <text x="494" y="208" textAnchor="middle" className="text-[11px] font-semibold">
                N
              </text>
            </g>

            {/* the bus, nose up in its own frame; the animation moves and turns it along the road */}
            <g ref={bus} transform="translate(120 360) rotate(75) scale(0.62)">
              <polygon ref={beam} points="31,-50 110,-50 110,52 31,52" fill="url(#hero-beam)" />
              <rect ref={shadow} x="-30" y="-64" width="60" height="128" rx="14" className="fill-ink" opacity="0.16" filter="url(#hero-blur)" />
              <rect x="-30" y="-64" width="60" height="128" rx="14" strokeWidth="3" className="fill-surface stroke-ink-2" />
              <path d="M-21 -55 Q0 -63 21 -55 L21 -49 Q0 -55 -21 -49 Z" className="fill-ink-2" opacity="0.35" />
              {WINDOWS.map((y) => (
                <g key={y}>
                  <rect x="-32" y={y} width="5" height="12" rx="2" className={`transition-colors duration-300 ${sunny === 'left' ? 'fill-brand' : 'fill-axis'}`} />
                  <rect x="27" y={y} width="5" height="12" rx="2" className={`transition-colors duration-300 ${sunny === 'right' ? 'fill-brand' : 'fill-axis'}`} />
                </g>
              ))}
              {SEAT_ROWS.map((y) =>
                [-22, -11, 2, 13].map((x) => {
                  const hot = (x < 0 && sunny === 'left') || (x > 0 && sunny === 'right');
                  return (
                    <rect
                      key={`${x},${y}`}
                      x={x}
                      y={y}
                      width="9"
                      height="11"
                      rx="2.5"
                      strokeWidth="1.5"
                      className={`transition-colors duration-300 ${hot ? 'fill-brand-soft stroke-brand' : 'fill-ink stroke-ink'}`}
                    />
                  );
                }),
              )}
            </g>
          </svg>

          {/* what the bus feels right now */}
          <div aria-hidden className="absolute top-3 left-3 flex items-center gap-2.5 rounded-2xl bg-surface/90 px-3 py-2 text-xs shadow-lg ring-1 ring-ink/5 backdrop-blur sm:top-4 sm:left-4">
            <Clock className="size-3.5 text-muted" />
            <span className="font-semibold tabular-nums">{clock}</span>
            <span className="h-3.5 w-px bg-hairline" />
            <span className="flex items-center gap-1.5 text-ink-2">
              <span className={`size-2 rounded-full transition-colors ${sunny === 'left' ? 'bg-sun-left' : sunny === 'right' ? 'bg-sun-right' : 'bg-sun-ends'}`} />
              {readout.now === 'left' || readout.now === 'right' ? `Sun on the ${readout.now}` : `Sun ${readout.now}`}
            </span>
          </div>
        </div>

        {/* the sums so far, and the answer at the end */}
        <div aria-hidden className="grid items-center gap-x-5 gap-y-3 border-t border-hairline px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted">Direct sun through each side so far</p>
            <Tally name="Left" minutes={readout.left} bar="bg-sun-left" />
            <Tally name="Right" minutes={readout.right} bar="bg-sun-right" />
          </div>
          <div className="flex min-h-11 items-center sm:justify-end">
            {readout.done ? (
              <p key="done" className="flex animate-pop items-center gap-2 rounded-2xl bg-good/10 px-3.5 py-2 text-sm font-semibold ring-1 ring-good/30">
                <span className="grid size-5 place-items-center rounded-full bg-good text-white">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                Sit on the {sit}
              </p>
            ) : (
              <p key="driving" className="flex items-center gap-2 text-xs text-ink-2">
                <span className="relative flex size-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-60" />
                  <span className="relative size-2 rounded-full bg-brand" />
                </span>
                Following the road, minute by minute
              </p>
            )}
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        An animation of a bus on a winding road under a morning sun in the south-east. At each bend the sun swings to the other side of the bus; over
        the whole trip the right side gets far more sun, so the answer is to sit on the left.
      </figcaption>
    </figure>
  );
}

function Tally({ name, minutes, bar }: { name: string; minutes: number; bar: string }) {
  return (
    <div className="grid grid-cols-[2.6rem_minmax(0,1fr)_4.6rem] items-center gap-2.5 text-xs">
      <span className="text-ink-2">{name}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-hairline">
        <span className={`block h-full rounded-full transition-[width] duration-200 ${bar}`} style={{ width: `${(minutes / MINUTES) * 100}%` }} />
      </span>
      <span className="text-right font-semibold tabular-nums">{shortDuration(minutes)}</span>
    </div>
  );
}

/** Points along the drive, evenly spaced, with the light in the bus's frame and the sun added up so far. */
function sampleRoad(path: SVGPathElement): Sample[] {
  const total = path.getTotalLength();
  const samples: Sample[] = [];
  let left = 0;
  let right = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const at = total * (TRIP.from + ((TRIP.to - TRIP.from) * i) / SAMPLES);
    const p = path.getPointAtLength(at);
    const behind = path.getPointAtLength(Math.max(0, at - 2));
    const ahead = path.getPointAtLength(Math.min(total, at + 2));
    const angle = Math.atan2(ahead.x - behind.x, behind.y - ahead.y); // clockwise from up
    const lx = LIGHT[0] * Math.cos(angle) + LIGHT[1] * Math.sin(angle);
    const ly = -LIGHT[0] * Math.sin(angle) + LIGHT[1] * Math.cos(angle);
    if (i > 0 && Math.abs(lx) > SIDE) {
      if (lx > 0) right += MINUTES / SAMPLES;
      else left += MINUTES / SAMPLES;
    }
    samples.push({ x: p.x, y: p.y, angle: (angle * 180) / Math.PI, lx, ly, left, right });
  }
  return samples;
}
