// Small shared building blocks, so every card and button looks the same.
import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** The look of every card on the page. */
export const CARD = 'rounded-3xl bg-surface ring-1 ring-ink/[0.06] shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-16px_rgb(0_0_0/0.18)]';

/** A small label above a heading. */
export const EYEBROW = 'text-xs font-semibold tracking-[0.08em] text-muted uppercase';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-surface hover:bg-ink/85 shadow-sm',
  secondary: 'bg-surface text-ink ring-1 ring-hairline hover:bg-raised',
  ghost: 'text-ink-2 hover:bg-ink/[0.05] hover:text-ink',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: LucideIcon;
  /** Show only the icon, with the text kept for screen readers. */
  iconOnly?: boolean;
}

export function Button({ variant = 'secondary', icon: Icon, iconOnly, children, className = '', ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none disabled:opacity-50 ${
        iconOnly ? 'size-9' : 'px-3.5 py-2'
      } ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {Icon && <Icon aria-hidden className="size-4 shrink-0" />}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </button>
  );
}

type Tone = 'good' | 'neutral' | 'quiet';

const TONES: Record<Tone, string> = {
  good: 'bg-good/10 text-ink ring-good/30',
  neutral: 'bg-brand-soft text-ink ring-brand/30',
  quiet: 'bg-ink/[0.04] text-ink-2 ring-hairline',
};

/** A rounded tag, e.g. "Clear winner". */
export function Pill({ tone = 'quiet', icon: Icon, children }: { tone?: Tone; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${TONES[tone]}`}>
      {Icon && <Icon aria-hidden className={`size-3.5 ${tone === 'good' ? 'text-good' : tone === 'neutral' ? 'text-brand' : ''}`} />}
      {children}
    </span>
  );
}
