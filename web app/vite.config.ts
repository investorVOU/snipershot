import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  esbuild: mode === 'production'
    ? { drop: ['console', 'debugger'] }
    : undefined,
  server: {
    proxy: {
      '/birdeye': {
        target: 'https://public-api.birdeye.so',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/birdeye/, ''),
        headers: { 'x-chain': 'solana' },
      },
      '/dexscreener': {
        target: 'https://api.dexscreener.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dexscreener/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          charts: ['lightweight-charts'],
        },
      },
    },
  },
}))
