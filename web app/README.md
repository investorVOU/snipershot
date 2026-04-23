# Axyrion Web

Axyrion is a Solana token discovery and execution app built for fast market reads, compact risk context, and in-app trading workflows. This `web app` folder contains the React + Vite frontend used for the Birdeye build-in-public submission path.

The product is designed around a simple loop:

1. discover fresh tokens and active market opportunities
2. inspect context quickly
3. apply AI-assisted and on-chain risk signals
4. move from research to execution in one interface

## What the app does

Axyrion focuses on Solana memecoin intelligence and execution:

- live token discovery and feed views
- token detail views with charting and context
- rug and security signal surfacing
- AI-assisted token screening
- built-in wallet flow for signed actions on the device
- launch flow for creating new tokens
- swap history and wallet management

## Why this exists

Most Solana token workflows are fragmented. Discovery, charting, risk checks, wallet context, and execution often live across multiple tabs and products. Axyrion compresses those steps into one compact interface so users can evaluate a setup faster and act without losing context.

## Birdeye Data usage

Birdeye Data powers the market intelligence layer of the app.

The app uses Birdeye for:

- token discovery
- token overview and market stats
- OHLCV chart data
- live token pricing
- holder count estimation
- token security context

### Birdeye endpoints used

The current web app integrates the following Birdeye endpoints through the app service layer:

- `/defi/token_trending`
  Used to surface trending Solana tokens and improve discovery flows.
- `/defi/token_overview`
  Used for token price, market cap, volume, liquidity, holder count, and FDV context.
- `/defi/ohlcv`
  Used for historical candles and sparkline/chart rendering.
- `/defi/v3/token/holder`
  Used to estimate or retrieve token holder counts.
- `/defi/price`
  Used for live token price lookups.
- `/defi/token_security`
  Used for risk-related metadata and security checks.

Birdeye requests are proxied through a Supabase Edge Function in production to avoid browser CORS issues and keep the integration reliable.

## AI-assisted screening

Axyrion layers AI-assisted token screening on top of market and security data.

The AI layer is used to:

- summarize risk context
- label setups as bullish / neutral / bearish / scam
- explain token concerns in plain language
- help users make faster go-or-no-go decisions

The current implementation uses a Groq-backed inference path through a Supabase Edge Function, combined with app-side risk features and token context.

## Main product areas

### 1. Discovery feed

The feed aggregates token opportunities from multiple sources and lets users move quickly from token discovery into deeper inspection.

### 2. Token detail and context

Each token view is built to expose the core information needed for a fast decision:

- market data
- liquidity and holder context
- rug and authority signals
- chart history
- creator and token metadata

### 3. AI + risk layer

The app combines deterministic signals with AI-assisted summaries so users can interpret token quality faster.

### 4. Wallet and execution

The app includes a built-in wallet model for local browser-based signing on the current device, plus swap and wallet management flows.

### 5. Token launch flow

The codebase includes launch-related modules for creating and recording token launches, launch events, metadata handling, and related Supabase persistence.

## Tech stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- Solana Web3.js
- Birdeye Data
- Groq

## Architecture overview

### Frontend

The app frontend lives in `src/` and is organized around:

- `pages/` for route-level screens
- `components/` for reusable UI
- `hooks/` for data and state orchestration
- `services/` for external data integrations
- `lib/` for provider, Solana, Supabase, and utility logic
- `types/` for shared domain models

### Supabase

Supabase is used for:

- auth and session handling
- edge function proxies
- persistence for launched tokens and swap-related records
- migration-managed schema changes

Current edge functions in `supabase/functions/` include:

- `birdeye-proxy`
- `dexscreener-proxy`
- `groq-proxy`
- `launch-provider`

### Data flow

At a high level:

1. the UI requests token data through service-layer functions
2. Birdeye and other market sources provide token and chart context
3. security/risk helpers enrich the token object
4. AI screening summarizes risk and opportunity context
5. the UI renders compact decision support and action flows

## Local setup

### Requirements

- Node.js 18+
- npm
- a Supabase project
- a Birdeye API key
- a Groq API key
- a Solana RPC endpoint

### Install

```bash
npm install
```

### Environment variables

Create a local `.env` based on `.env.example`.

Current expected variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BIRDEYE_KEY=
VITE_GROQ_API_KEY=
VITE_HELIUS_API_KEY=
VITE_SOLANA_RPC=
BAGS_API_KEY=
PINATA_API_KEY=
PINATA_API_SECRET=
PINATA_JWT=
```

Notes:

- `VITE_BIRDEYE_KEY` is used in local/dev fallback paths.
- production Birdeye requests should prefer the Supabase Edge Function secret.
- `VITE_SOLANA_RPC` should point at a working Solana RPC endpoint.

### Run locally

```bash
npm run dev
```

### Production build

```bash
npm run build
```

## Important implementation notes

### Wallet model

The current web app uses a built-in wallet model generated in the browser and stored locally on the device. This is explicitly surfaced in the product UX and should be understood before production use.

### External market sources

While Birdeye powers the main market data layer described above, the codebase also contains integrations and fallbacks for other services where needed for resilience or supplementary data.

### Submission note

This repository root contains other project work. The relevant source for this web submission is the `web app` folder specifically.

## Relevant source paths

- `src/pages/Feed.tsx`
- `src/pages/TokenDetail.tsx`
- `src/pages/Wallet.tsx`
- `src/services/birdeye.ts`
- `src/services/groq.ts`
- `src/components/TokenCard.tsx`
- `src/hooks/useSwap.ts`
- `src/hooks/useLaunchToken.ts`
- `supabase/functions/birdeye-proxy/index.ts`
- `supabase/migrations/`

## Presentation notes for reviewers

This project is intentionally focused on:

- compact token discovery
- fast decision support
- AI-assisted screening
- Solana-native execution workflows

Birdeye Data is a core part of the product, not a cosmetic add-on. It is used directly in token discovery, overview, charting, price lookup, holder context, and security-driven evaluation.

## Status

The app is an active work in progress and includes both shipped flows and ongoing product iteration. The repository reflects real build activity rather than a static demo mockup.
