import { Circle, CircleCheck, LoaderCircle } from 'lucide-react';
import { CARD } from './ui.tsx';

export const STEPS = ['Finding the places', 'Finding routes and the forecast', 'Working out the sun, minute by minute'];

/** What it's doing while you wait, step by step. */
export function Progress({ step }: { step: number }) {
  return (
    <div role="status" className={`${CARD} px-5 py-4`}>
      <ol className="space-y-2.5 text-sm">
        {STEPS.map((label, i) => {
          const Icon = i < step ? CircleCheck : i === step ? LoaderCircle : Circle;
          return (
            <li key={label} className={`flex items-center gap-3 ${i > step ? 'text-muted' : i === step ? 'font-medium text-ink' : 'text-ink-2'}`}>
              <Icon aria-hidden className={`size-4 shrink-0 ${i < step ? 'text-good' : i === step ? 'animate-spin text-brand' : ''}`} />
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
  const block = 'animate-pulse rounded-2xl bg-ink/[0.06]';
  return (
    <div aria-hidden className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:gap-6">
      <div className={`${CARD} space-y-4 p-6`}>
        <div className={`${block} h-6 w-28`} />
        <div className={`${block} h-11 w-3/4`} />
        <div className="flex gap-4">
          <div className={`${block} h-40 w-28`} />
          <div className="flex-1 space-y-2">
            <div className={`${block} h-[4.6rem]`} />
            <div className={`${block} h-[4.6rem]`} />
          </div>
        </div>
        <div className={`${block} h-4 w-full`} />
        <div className={`${block} h-4 w-5/6`} />
      </div>
      <div className={`${CARD} p-3`}>
        <div className={`${block} h-72 lg:h-[30rem]`} />
      </div>
    </div>
  );
}
