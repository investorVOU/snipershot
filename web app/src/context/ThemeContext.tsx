import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type Theme = 'dark' | 'light'

export const DARK = {
  bg: '#0a0a0f',
  card: '#12121a',
  border: '#1e1e2e',
  surface: '#0d0d14',
  text: '#ffffff',
  textMuted: '#666666',
  textSub: '#dddddd',
  accent: '#9945ff',
  green: '#14f195',
  red: '#ff4444',
  yellow: '#f5a623',
}

export const LIGHT = {
  bg: '#f2f2fa',
  card: '#ffffff',
  border: '#e2e2f0',
  surface: '#eaeaf5',
  text: '#111111',
  textMuted: '#888888',
  textSub: '#444444',
  accent: '#7733dd',
  green: '#00aa66',
  red: '#cc2222',
  yellow: '#bb7700',
}

type Colors = typeof DARK

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  colors: Colors
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
  colors: DARK,
  isDark: true,
})

const THEME_KEY = 'app_theme'

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY)
      if (stored === 'dark' || stored === 'light') {
        setThemeState(stored)
        applyTheme(stored)
        return
      }
    } catch {
      // Ignore storage issues.
    }
    applyTheme('dark')
  }, [])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Ignore storage issues.
    }
    applyTheme(next)
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  const value = useMemo(() => ({
    theme,
    toggleTheme,
    setTheme,
    colors: theme === 'dark' ? DARK : LIGHT,
    isDark: theme === 'dark',
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
