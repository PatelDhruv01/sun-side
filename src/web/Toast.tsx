import { CircleCheck } from 'lucide-react';

/** A short message at the bottom of the screen, e.g. "Link copied". */
export function Toast({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {message && (
        <p className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-surface shadow-xl">
          <CircleCheck aria-hidden className="size-4 text-brand" />
          {message}
        </p>
      )}
    </div>
  );
}
