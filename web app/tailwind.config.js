/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--color-brand) / <alpha-value>)',
          dark: 'rgb(var(--color-brand-dark) / <alpha-value>)',
          muted: 'rgb(var(--color-brand) / 0.12)',
        },
        dark: {
          bg: 'rgb(var(--color-bg) / <alpha-value>)',
          card: 'rgb(var(--color-card) / <alpha-value>)',
          border: 'rgb(var(--color-border) / <alpha-value>)',
          muted: 'rgb(var(--color-muted) / <alpha-value>)',
          text: 'rgb(var(--color-text) / <alpha-value>)',
          subtext: 'rgb(var(--color-subtext) / <alpha-value>)',
          faint: 'rgb(var(--color-faint) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
