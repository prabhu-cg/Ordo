import { create } from 'zustand'

export type Theme = 'light' | 'dark'
const KEY = 'theme'

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Storage may be blocked; the theme still applies for this session.
  }
}

interface ThemeState {
  theme: Theme
  toggle: () => void
}

/** Light or dark, nothing else. The inline script in index.html applies it before first paint. */
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: read(),
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    apply(next)
    set({ theme: next })
  },
}))
