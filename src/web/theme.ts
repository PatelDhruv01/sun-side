// Light, dark, or whatever the system says. The pick is kept in localStorage; index.html
// applies it before the first paint so a dark page never flashes light.
import { useSyncExternalStore } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'theme';
const DARK = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();

function stored(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system'; // storage can be blocked; the system setting still works
  }
}

let choice: ThemeChoice = stored();

export function setTheme(next: ThemeChoice) {
  choice = next;
  try {
    if (next === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // not remembered, but still applied for this visit
  }
  if (next === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const query = window.matchMedia(DARK);
  query.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    query.removeEventListener('change', listener);
  };
}

/** The reader's pick, and whether the page is dark right now. */
export function useTheme(): { choice: ThemeChoice; dark: boolean } {
  const current = useSyncExternalStore(subscribe, () => choice);
  const systemDark = useSyncExternalStore(subscribe, () => window.matchMedia(DARK).matches);
  return { choice: current, dark: current === 'dark' || (current === 'system' && systemDark) };
}
