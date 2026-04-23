/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_BIRDEYE_KEY: string
  readonly VITE_HELIUS_API_KEY: string
  readonly VITE_SOLANA_RPC: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
