import { CircleCheck, Info, TriangleAlert } from 'lucide-react';

export interface ToastMessage {
  /** New for every message, so the same text twice still slides in again. */
  id: number;
  text: string;
  tone: 'done' | 'info' | 'warn';
}

const ICONS = { done: CircleCheck, info: Info, warn: TriangleAlert };

/** A short message at the bottom of the screen, e.g. "Link copied". */
export function Toast({ message }: { message: ToastMessage | null }) {
  const Icon = message ? ICONS[message.tone] : null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      {message && Icon && (
        <p key={message.id} className="flex animate-rise items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-surface shadow-xl [animation-duration:0.4s]">
          <Icon aria-hidden className="size-4 shrink-0 text-brand" />
          {message.text}
        </p>
      )}
    </div>
  );
}
