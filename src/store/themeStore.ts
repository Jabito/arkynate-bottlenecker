import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light' | 'matrix';

/**
 * Puts the theme class on <body>. The Navbar calls this with the stored theme
 * on /playground and with 'dark' everywhere else, so the content pages always
 * render with the dark tokens (#17).
 */
export function applyTheme(theme: Theme) {
  const body = document.body;
  Array.from(body.classList)
    .filter(c => c.startsWith('theme-'))
    .forEach(c => body.classList.remove(c));
  if (theme !== 'dark') {
    body.classList.add(`theme-${theme}`);
  }
}

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'bottlenecker-theme',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
