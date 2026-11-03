import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from './Logo.tsx';
import { switchTheme, useTheme, type ThemeChoice } from './theme.ts';
import { Button } from './ui.tsx';

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };
const ICONS = { system: Monitor, light: Sun, dark: Moon };

interface Props {
  /** Back to the start page. */
  onHome: () => void;
  /** Links to the start page's sections, shown there only. */
  sections: boolean;
}

export function Header({ onHome, sections }: Props) {
  const { choice } = useTheme();
  const scrolled = useScrolled();
  return (
    <header
      className={`sticky top-0 z-30 border-b bg-page/75 backdrop-blur-lg transition-[border-color,box-shadow] duration-300 ${
        scrolled ? 'border-hairline/80 shadow-[0_8px_24px_-18px_rgb(0_0_0/0.35)]' : 'border-transparent'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <a
          href="./"
          onClick={(e) => {
            e.preventDefault();
            onHome();
          }}
          className="group -ml-1 flex items-center gap-2.5 rounded-lg px-1 py-1 text-[15px] font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <Logo className="size-7 transition-transform duration-500 ease-glide group-hover:rotate-[20deg]" />
          Sun Side
        </a>
        {sections && (
          <nav aria-label="Sections" className="ml-auto hidden items-center gap-1 text-sm text-ink-2 sm:flex">
            {[
              ['#how', 'How it works'],
              ['#features', 'Features'],
              ['#faq', 'FAQ'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-lg px-3 py-1.5 transition-colors hover:bg-ink/[0.05] hover:text-ink">
                {label}
              </a>
            ))}
          </nav>
        )}
        <Button
          variant="ghost"
          iconOnly
          icon={ICONS[choice]}
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            switchTheme(NEXT[choice], { x: box.left + box.width / 2, y: box.top + box.height / 2 });
          }}
          className={sections ? 'ml-auto sm:ml-1' : 'ml-auto'}
          title={`Theme: ${choice}. Switch to ${NEXT[choice]}.`}
        >
          {`Theme: ${choice}. Switch to ${NEXT[choice]}.`}
        </Button>
      </div>
    </header>
  );
}

/** Whether the page has scrolled off the top, for the header's edge. */
function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return scrolled;
}
