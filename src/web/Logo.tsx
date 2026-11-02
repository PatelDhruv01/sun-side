/** The mark: a sun lit on one side and in shade on the other. */
export function Logo({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="15" className="fill-ink" />
      <g strokeWidth="4" strokeLinecap="round" className="stroke-brand">
        <path d="M32 11v6M32 47v6M46.8 17.2l-4.2 4.2M46.8 46.8l-4.2-4.2M53 32h-6" />
      </g>
      <path d="M32 20a12 12 0 0 1 0 24z" className="fill-brand" />
      <path d="M32 20a12 12 0 0 0 0 24z" className="fill-muted" />
    </svg>
  );
}
