import { useSyncExternalStore } from 'react';
import { safeStorage } from '@/lib/safeStorage';

type Theme = 'light' | 'dark';
const THEME_KEY = 'theme_v2';
const listeners = new Set<() => void>();

function readTheme(): Theme {
  const stored = safeStorage.getItem(THEME_KEY);
  // Light by default; dark is opt-in.
  return stored === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  safeStorage.setItem(THEME_KEY, theme);
  listeners.forEach((l) => l());
}

// One shared value: every toggle on screen (settings, preview switcher) stays in step.
export function useTheme() {
  const theme = useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, readTheme);
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  return { theme, setTheme, toggleTheme };
}
