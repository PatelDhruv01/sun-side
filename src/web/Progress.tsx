import { Circle, CircleCheck, LoaderCircle } from 'lucide-react';
import { CARD, stagger } from './ui.tsx';

export const STEPS = ['Finding the places', 'Finding routes and the forecast', 'Working out the sun, minute by minute'];

/** What it's doing while you wait, step by step, with a bar along the top. */
export function Progress({ step }: { step: number }) {
  return (
    <div role="status" className={`${CARD} relative animate-rise overflow-hidden px-5 py-4`}>
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-hairline/70">
        <div
          className="h-full rounded-r-full bg-brand shadow-[0_0_12px_var(--color-brand)] transition-[width] duration-700 ease-glide"
          style={{ width: `${((step + 0.65) / STEPS.length) * 100}%` }}
        />
      </div>
      <ol className="space-y-2.5 text-sm">
        {STEPS.map((label, i) => {
          const Icon = i < step ? CircleCheck : i === step ? LoaderCircle : Circle;
          return (
            <li key={label} className={`flex items-center gap-3 transition-colors duration-300 ${i > step ? 'text-muted' : i === step ? 'font-medium text-ink' : 'text-ink-2'}`}>
              <Icon key={i < step ? 'done' : 'todo'} aria-hidden className={`size-4 shrink-0 ${i < step ? 'animate-pop text-good' : i === step ? 'animate-spin text-brand' : ''}`} />
              {label}
              {i === step && <span className="sr-only">(in progress)</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The shape of the answer, while the first one loads. */
export function ResultsSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:gap-6">
      <div className={`${CARD} animate-rise space-y-4 p-6`} style={stagger(1)}>
        <div className="skeleton h-6 w-28" />
        <div className="skeleton h-11 w-3/4" />
        <div className="flex gap-4">
          <div className="skeleton h-40 w-28" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-[4.6rem]" />
            <div className="skeleton h-[4.6rem]" />
          </div>
        </div>
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
      </div>
      <div className={`${CARD} animate-rise p-3`} style={stagger(2)}>
        <div className="skeleton h-72 lg:h-[30rem]" />
      </div>
    </div>
  );
}
