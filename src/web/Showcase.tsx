// Small pictures for the start page, drawn with the same tokens and shapes as the real answer
// so that what you see here is what you get. The examples are from real runs of the app.
import { Bus, Car, Check, Cloud, CloudFog, Laptop, Link2, Moon, Repeat2, Smartphone, Sun } from 'lucide-react';

/** A road coloured by where the sun is, like the map in the answer. */
export function MiniRoute() {
  const legs: [string, string][] = [
    ['M14 72 C40 68 62 52 92 47', 'stroke-sun-right'],
    ['M92 47 C112 44 124 31 148 29', 'stroke-sun-ends'],
    ['M148 29 C172 27 186 52 206 54', 'stroke-sun-left'],
    ['M206 54 C216 55 222 48 228 42', 'stroke-sun-right'],
  ];
  return (
    <svg viewBox="0 0 240 90" className="h-auto w-full" aria-hidden>
      <path d={legs.map(([d], i) => (i === 0 ? d : d.replace(/^M[\d.]+ [\d.]+ /, ''))).join(' ')} fill="none" strokeWidth="11" strokeLinecap="round" className="stroke-surface" />
      {legs.map(([d, stroke]) => (
        <path key={d} d={d} fill="none" strokeWidth="5" strokeLinecap="round" className={stroke} />
      ))}
      <circle cx="14" cy="72" r="5" strokeWidth="2" className="fill-ink stroke-surface" />
      <circle cx="228" cy="42" r="5" strokeWidth="2" className="fill-surface stroke-ink" />
    </svg>
  );
}

/** Sun on each side window over a trip: a little of the timeline chart. */
export function MiniTimeline() {
  const lanes = [
    { top: 6, values: [0.05, 0.04, 0.08, 0.3, 0.22, 0.06, 0.05, 0.04, 0.1, 0.06, 0.05], stroke: 'stroke-sun-left', fill: 'fill-sun-left/10' },
    { top: 50, values: [0.62, 0.7, 0.74, 0.4, 0.5, 0.78, 0.84, 0.86, 0.7, 0.8, 0.76], stroke: 'stroke-sun-right', fill: 'fill-sun-right/10' },
  ];
  return (
    <svg viewBox="0 0 240 90" className="h-auto w-full" aria-hidden>
      {lanes.map(({ top, values, stroke, fill }) => {
        const base = top + 30;
        const points = values.map((v, i) => `${(8 + (i * 224) / (values.length - 1)).toFixed(1)},${(base - v * 30).toFixed(1)}`).join(' ');
        return (
          <g key={top}>
            <polygon points={`8,${base} ${points} 232,${base}`} className={fill} />
            <polyline points={points} fill="none" strokeWidth="2" strokeLinejoin="round" className={stroke} />
            <line x1="8" x2="232" y1={base} y2={base} className="stroke-axis" />
          </g>
        );
      })}
    </svg>
  );
}

/** Two rows of a bus, the side to take filled in. */
export function MiniSeats() {
  return (
    <svg viewBox="0 0 240 90" className="h-auto w-full" aria-hidden>
      <rect x="78" y="6" width="84" height="78" rx="16" strokeWidth="2" className="fill-surface stroke-axis" />
      {[18, 38, 58].map((y) =>
        [88, 103, 125, 140].map((x) => (
          <rect key={`${x},${y}`} x={x} y={y} width="12" height="14" rx="3" strokeWidth="1.5" className={x < 120 ? 'fill-ink stroke-ink' : 'fill-brand-soft stroke-brand'} />
        )),
      )}
      {[16, 36, 56].map((y) => (
        <rect key={y} x="159" y={y} width="5" height="16" rx="2" className="fill-brand" />
      ))}
      <g transform="translate(56 45)">
        <circle r="11" className="fill-good" />
        <path d="M-5 0.5 l3.5 3.5 l6.5 -7" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className="stroke-brand" strokeWidth="2.5" strokeLinecap="round">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return <line key={i} x1={200 + Math.cos(a) * 12} y1={45 + Math.sin(a) * 12} x2={200 + Math.cos(a) * 17} y2={45 + Math.sin(a) * 17} />;
        })}
      </g>
      <circle cx="200" cy="45" r="8" className="fill-brand" />
    </svg>
  );
}

/**
 * Every departure across a day, like the "Not sure yet" answer: Ahmedabad → Himatnagar in
 * December, 06:00–17:00. Sun on the right means sit left, and the other way round.
 */
export function MiniDayStrip() {
  const cells = [
    ...Array(2).fill('bg-night'),
    ...Array(12).fill('bg-sun-right'),
    ...Array(4).fill('bg-weak'),
    ...Array(6).fill('bg-sun-left'),
    ...Array(2).fill('bg-night'),
  ];
  return (
    <div aria-hidden>
      <div className="flex h-10 gap-[2px]">
        {cells.map((fill, i) => (
          <span key={i} className={`flex-1 first:rounded-l-lg last:rounded-r-lg ${fill}`} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted tabular-nums">
        {['05:00', '08:00', '11:00', '14:00', '17:00'].map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <div className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
        <p className="flex items-center gap-2 rounded-xl bg-raised px-3 py-2 ring-1 ring-hairline">
          <span className="size-2.5 rounded-sm bg-sun-right" />
          <span className="tabular-nums text-ink-2">06:00–12:00</span>
          <span className="font-semibold">sit LEFT</span>
        </p>
        <p className="flex items-center gap-2 rounded-xl bg-raised px-3 py-2 ring-1 ring-hairline">
          <span className="size-2.5 rounded-sm bg-sun-left" />
          <span className="tabular-nums text-ink-2">14:00–16:30</span>
          <span className="font-semibold">sit RIGHT</span>
        </p>
      </div>
    </div>
  );
}

/** A trip where it pays to move: start on one side, cross over partway. */
export function MiniSeatChange() {
  return (
    <div aria-hidden>
      <div className="flex h-9 gap-[2px] overflow-hidden rounded-xl text-[11px] font-semibold text-surface">
        <div className="flex w-[58%] items-center justify-center bg-ink">Sit right</div>
        <div className="flex flex-1 items-center justify-center bg-ink-2">Sit left</div>
      </div>
      <div className="relative mt-1.5 h-4 text-[10px] text-muted tabular-nums">
        <span className="absolute left-0">11:30</span>
        <span className="absolute left-[58%] -translate-x-1/2 font-medium text-ink-2">13:16</span>
        <span className="absolute right-0">15:10</span>
      </div>
    </div>
  );
}

/** What the forecast does to the answer. */
export function MiniWeather() {
  const rows = [
    { icon: Sun, text: 'Clear', detail: 'full sun to dodge' },
    { icon: CloudFog, text: 'Hazy', detail: 'takes the edge off' },
    { icon: Cloud, text: 'Cloudy', detail: 'little to dodge' },
  ];
  return (
    <ul aria-hidden className="space-y-1.5 text-xs">
      {rows.map(({ icon: Icon, text, detail }) => (
        <li key={text} className="flex items-center gap-2.5 rounded-xl bg-raised px-3 py-2 ring-1 ring-hairline">
          <Icon className="size-4 text-brand" />
          <span className="font-semibold">{text}</span>
          <span className="text-ink-2">{detail}</span>
        </li>
      ))}
    </ul>
  );
}

/** Two routes to choose between, like the route list in the answer. */
export function MiniRoutes() {
  return (
    <ul aria-hidden className="divide-y divide-hairline rounded-2xl text-xs ring-1 ring-hairline">
      {[
        { on: true, label: 'Main road', time: '1 h 32 min', verdict: 'Sit left' },
        { on: false, label: 'Through the town', time: '1 h 50 min', verdict: 'Either side' },
      ].map(({ on, label, time, verdict }) => (
        <li key={label} className="flex items-center gap-2.5 px-3 py-2.5">
          <span className={`grid size-4 place-items-center rounded-full ring-2 ${on ? 'ring-ink' : 'ring-axis'}`}>{on && <span className="size-2 rounded-full bg-ink" />}</span>
          <span className="font-medium">{label}</span>
          <span className="text-muted tabular-nums">{time}</span>
          <span className={`ml-auto ${on ? 'font-semibold' : 'text-ink-2'}`}>{verdict}</span>
        </li>
      ))}
    </ul>
  );
}

/** A trip's link, and the way back. */
export function MiniShare() {
  return (
    <div aria-hidden className="space-y-2 text-xs">
      <p className="flex items-center gap-2 truncate rounded-xl bg-raised px-3 py-2 text-ink-2 ring-1 ring-hairline">
        <Link2 className="size-3.5 shrink-0 text-muted" />
        <span className="truncate">…/?from=Ahmedabad&amp;to=Himatnagar&amp;time=09:00</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 font-medium text-surface">
          <Check className="size-3.5 text-brand" strokeWidth={3} />
          Link copied
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 font-medium ring-1 ring-hairline">
          <Repeat2 className="size-3.5" />
          Return trip
        </span>
      </div>
    </div>
  );
}

/** Phone or laptop, light or dark, bus or car. */
export function MiniDevices() {
  return (
    <div aria-hidden className="flex flex-wrap items-center gap-2 text-ink-2">
      {[Smartphone, Laptop, Sun, Moon, Bus, Car].map((Icon, i) => (
        <span key={i} className="grid size-10 place-items-center rounded-xl bg-raised ring-1 ring-hairline">
          <Icon className="size-[18px]" />
        </span>
      ))}
    </div>
  );
}
