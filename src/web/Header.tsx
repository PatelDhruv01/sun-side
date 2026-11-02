import { Monitor, Moon, Sun } from 'lucide-react';
import { Logo } from './Logo.tsx';
import { setTheme, useTheme, type ThemeChoice } from './theme.ts';
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
  return (
    <header className="sticky top-0 z-30 border-b border-hairline/70 bg-page/75 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <a
          href="./"
          onClick={(e) => {
            e.preventDefault();
            onHome();
          }}
          className="-ml-1 flex items-center gap-2.5 rounded-lg px-1 py-1 text-[15px] font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          <Logo />
          Sun Side
        </a>
        {sections && (
          <nav aria-label="Sections" className="ml-auto hidden items-center gap-1 text-sm text-ink-2 sm:flex">
            <a href="#how" className="rounded-lg px-3 py-1.5 hover:bg-ink/[0.05] hover:text-ink">
              How it works
            </a>
            <a href="#faq" className="rounded-lg px-3 py-1.5 hover:bg-ink/[0.05] hover:text-ink">
              FAQ
            </a>
          </nav>
        )}
        <Button
          variant="ghost"
          iconOnly
          icon={ICONS[choice]}
          onClick={() => setTheme(NEXT[choice])}
          className={sections ? 'ml-auto sm:ml-1' : 'ml-auto'}
          title={`Theme: ${choice}. Switch to ${NEXT[choice]}.`}
        >
          {`Theme: ${choice}. Switch to ${NEXT[choice]}.`}
        </Button>
      </div>
    </header>
  );
}
