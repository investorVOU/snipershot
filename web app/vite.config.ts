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
        entryFileNames: 'assets/index.js',
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'vendor') return 'assets/vendor.js'
          if (chunkInfo.name === 'supabase') return 'assets/supabase.js'
          if (chunkInfo.name === 'charts') return 'assets/charts.js'
          return 'assets/[name].js'
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'assets/styles.css'
          return 'assets/[name][extname]'
        },
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          charts: ['lightweight-charts'],
        },
      },
    },
  },
}))
