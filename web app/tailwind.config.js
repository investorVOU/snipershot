/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#27c985',
          dark: '#1fa86e',
          muted: '#27c98520',
        },
        dark: {
          bg: '#0a0f16',
          card: '#111827',
          border: '#1f2937',
          muted: '#1e2a38',
          text: '#f3f6f8',
          subtext: '#7e8a99',
          faint: '#475261',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
