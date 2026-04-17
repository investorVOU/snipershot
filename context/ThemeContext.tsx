import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'dark' | 'light';

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
};

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
};

export type Colors = typeof DARK;

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: Colors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  colors: DARK,
  isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    AsyncStorage.getItem('app_theme')
      .then((v) => { if (v === 'light' || v === 'dark') setTheme(v); })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem('app_theme', next).catch(() => {});
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors: theme === 'dark' ? DARK : LIGHT, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
