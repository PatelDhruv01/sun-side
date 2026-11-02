import { useEffect, useState, type RefObject } from 'react';

const DARK = '(prefers-color-scheme: dark)';

/** Whether the reader's system is in dark mode, kept up to date. */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia(DARK).matches);
  useEffect(() => {
    const query = window.matchMedia(DARK);
    const update = () => setDark(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return dark;
}

/** An element's current width in CSS pixels (0 until it has been measured). */
export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** A colour from the page's theme by custom property, e.g. themeColour('--color-ink'), for canvas-drawn maps. */
export const themeColour = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
