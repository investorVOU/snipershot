# SniperShot

A Solana memecoin sniping app built with React Native + Expo. Real-time token discovery from pump.fun, AI-powered rug analysis, Jupiter-based swaps with Jito MEV bundles, and a full portfolio tracker — all in a mobile-first dark UI.

---

## Features

### Live Feed
- Real-time token stream via pump.fun WebSocket (PumpPortal)
- Animated token cards with slide-in effect on new arrivals
- Filter by safety tier: All / Safe / Medium / Risky
- Search by name or symbol
- Sparkline chart (24h price history) per token
- Live connection indicator + wallet badge in header

### AI Analysis (Groq LLaMA 3.3 70B)
- **AI Verdict Badge** — per-token SAFE / CAUTION / AVOID rating with confidence score
- **Narrative Tags** — auto-detects token meta (AI, Dog Coin, Political, etc.)
- **Token Chat** — full AI chat screen on each token detail page; ask any question in context (rug score, holders, LP, market cap pre-loaded)
- **Portfolio AI Coach** — analyzes open positions and gives HOLD / TAKE_PROFIT / CUT_LOSS / ADD_MORE advice

### Token Detail
- OHLCV candlestick chart (15m candles, 12h window, react-native-svg)
- Live stats: price, 1h change, market cap, 24h volume, liquidity, holders
- Rug filter breakdown (mint authority, freeze authority, LP lock, top holders, creator behavior)
- Social links (Twitter, Telegram, Website)
- Ask AI button → opens chat with full token context

### Sniping Engine
- Jupiter V6 swap API (quote + swap)
- Jito MEV bundle submission for front-run protection
- Priority fee modes: Normal / Fast
- Configurable slippage (default 15%)
- Auto-snipe mode: triggers on new safe tokens above LP threshold
- Take profit / stop loss automation

### Portfolio
- Open positions with unrealized P&L in real-time
- Sell All button per position
- Trade history (closed trades)
- Portfolio AI Coach summary

### Watchlist
- Star any token from feed or detail page
- Persistent across sessions

### Leaderboard
- Closed trade P&L ranking (personal)
- Win rate and total P&L summary

### Config
- SOL amount per snipe
- Slippage BPS
- Auto-snipe toggle + safety threshold + min LP
- Take profit / stop loss %
- Priority mode (normal / fast)
- Theme toggle (dark / light)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo (React Native) + Expo Router |
| Wallet | Privy Embedded Wallet |
| Blockchain | Solana Mainnet via Helius RPC |
| Swaps | Jupiter V6 API |
| MEV Protection | Jito Block Engine |
| Token Data | pump.fun API + PumpPortal WebSocket |
| Price/Charts | Birdeye API (OHLCV, token overview, price) |
| NFT Metadata | Helius DAS API |
| AI | Groq (LLaMA 3.3 70B + LLaMA 3.1 8B fallback) |
| Database | Supabase (trades, positions, watchlist, fee events) |
| Local Cache | AsyncStorage (feed cache, config, offline fallback) |
| Charts | react-native-svg (candlestick) |
| Icons | @expo/vector-icons (Feather) |

---

## Supabase Schema

Run this SQL in your Supabase project to create the required tables:

```sql
-- Trades (buy/sell events)
create table trades (
  id text primary key,
  timestamp timestamptz not null,
  user_pubkey text not null,
  token_mint text not null,
  token_name text,
  token_symbol text,
  type text not null, -- 'buy' | 'sell'
  amount_sol numeric not null,
  amount_tokens numeric not null,
  price_per_token numeric not null,
  tx_sig text not null,
  fee_lamports bigint default 0
);

-- Platform fee events
create table fee_events (
  id bigserial primary key,
  timestamp timestamptz not null,
  user_pubkey text not null,
  token_mint text not null,
  fee_lamports bigint not null,
  tx_sig text not null
);

-- Open/closed positions
create table positions (
  id bigserial primary key,
  mint text not null,
  trade_id text not null,
  user_pubkey text,
  token_name text,
  token_symbol text,
  image_uri text,
  entry_price_sol numeric not null,
  amount_tokens numeric not null,
  amount_sol_spent numeric not null,
  opened_at timestamptz not null,
  closed boolean default false,
  closed_at timestamptz,
  unique (mint, trade_id)
);

-- Watchlist
create table watchlist (
  id bigserial primary key,
  mint text unique not null,
  token_name text,
  token_symbol text,
  image_uri text,
  added_at timestamptz not null
);
```

---

## Environment Variables

Create a `.env` file (never commit this):

```env
GROQ_API_KEY=your_groq_api_key
EXPO_PUBLIC_HELIUS_KEY=your_helius_api_key
EXPO_PUBLIC_PRIVY_APP_ID=your_privy_app_id
EXPO_PUBLIC_PRIVY_CLIENT_ID=your_privy_client_id
EXPO_PUBLIC_BIRDEYE_KEY=your_birdeye_api_key
EXPO_PUBLIC_FEE_ACCOUNT=your_sol_fee_wallet_address
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> The Groq API key is used server-side via a proxy. If you're running locally, set `GROQ_API_KEY` in your `.env` and ensure `services/api.ts` points to your proxy or direct endpoint.

---

## Getting Started

```bash
# Install dependencies
npm install

# Start Expo dev server (LAN mode for Expo Go)
npx expo start --port 8081

# Or tunnel mode (requires ngrok)
npx expo start --tunnel
```

Scan the QR code with the **Expo Go** app on your device.

---

## Project Structure

```
app/
  (tabs)/
    feed.tsx          # Live token stream
    portfolio.tsx     # Open positions + trade history
    watchlist.tsx     # Saved tokens
    leaderboard.tsx   # Closed trade P&L ranking
    config.tsx        # Sniper configuration
    wallet.tsx        # Wallet management
  token/
    [mint].tsx        # Token detail page
    chat.tsx          # AI chat screen
components/
  TokenCard.tsx       # Feed card with AI badge + sparkline
  AnimatedTokenCard.tsx
  AIVerdictBadge.tsx
  AIVerdictModal.tsx
  NarrativeTags.tsx
  PortfolioAICoach.tsx
  PriceChart.tsx      # SVG candlestick chart
  SparklineChart.tsx
  SnipeSheet.tsx      # Buy/sell bottom sheet
  RugScoreBadge.tsx
  WalletBadge.tsx
hooks/
  useTokenFeed.ts     # WebSocket feed + rug filter queue
  usePortfolio.ts     # Positions + P&L calculation
  useSniper.ts        # Buy/sell + config
  useWatchlist.ts     # Watchlist + Supabase sync
  useAI.ts            # useAIVerdict, useTokenChat, usePortfolioAI
  useColors.ts        # Theme color aliases
  useWallet.ts        # Privy wallet adapter
services/
  birdeye.ts          # Price, OHLCV, token overview, security
  pumpfun.ts          # pump.fun REST API
  groq.ts             # AI verdict, narrative detection, portfolio advice
  tradeLogger.ts      # Trade + position logging (AsyncStorage + Supabase)
  supabase.ts         # Shared Supabase client
  jupiter.ts          # Quote + swap transactions
  jito.ts             # MEV bundle submission
  helius.ts           # RPC + DAS metadata
  rugFilter.ts        # On-chain rug scoring
  aiQueue.ts          # Concurrent AI request rate limiter
  autoSniper.ts       # Auto-snipe background logic
```

---

## Data Persistence

| Data | Local (AsyncStorage) | Cloud (Supabase) |
|---|---|---|
| Trades | ✅ (last 500) | ✅ real-time insert |
| Positions | ✅ | ✅ upsert on open, update on close |
| Watchlist | ✅ | ✅ upsert on add, delete on remove |
| Fee events | — | ✅ |
| Feed cache | ✅ (last 100 tokens) | — |
| Sniper config | ✅ | — |

---

## Key Concepts

**Rug Score** — 0–100 composite score from on-chain checks: mint authority revoked, freeze authority revoked, LP lock status, top-10 holder concentration, creator selling behavior. Score ≤20 = Safe, ≤50 = Caution, >50 = Risky.

**Auto-Snipe** — When enabled, any new token scoring below the configured threshold and above the min LP is automatically bought using the configured SOL amount.

**Jito Bundles** — Swaps are optionally submitted as Jito MEV bundles to guarantee inclusion and avoid sandwich attacks.

**AI Queue** — All Groq calls go through a concurrency-limited queue (max 2 in-flight, 600ms between requests) to avoid rate limiting on the free tier.
