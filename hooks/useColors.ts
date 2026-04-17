import { useTheme } from '../context/ThemeContext';

export function useColors() {
  const { colors } = useTheme();
  return {
    background: colors.bg,
    foreground: colors.text,
    card: colors.card,
    border: colors.border,
    muted: colors.surface,
    mutedForeground: colors.textMuted,
    primary: colors.accent,
    green: colors.green,
    red: colors.red,
    yellow: colors.yellow,
  };
}
