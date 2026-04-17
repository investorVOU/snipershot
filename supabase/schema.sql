-- SnapShot Sniper Supabase Schema

-- Trades table
create table if not exists trades (
  id text primary key,
  timestamp timestamptz not null default now(),
  user_pubkey text not null,
  token_mint text not null,
  token_name text,
  token_symbol text,
  type text not null check (type in ('buy', 'sell')),
  amount_sol numeric not null,
  amount_tokens numeric not null,
  price_per_token numeric,
  tx_sig text,
  fee_lamports bigint
);

create index if not exists trades_user_pubkey_idx on trades (user_pubkey);
create index if not exists trades_timestamp_idx on trades (timestamp desc);
create index if not exists trades_token_mint_idx on trades (token_mint);

-- Fee events table
create table if not exists fee_events (
  id bigserial primary key,
  timestamp timestamptz not null default now(),
  user_pubkey text not null,
  token_mint text not null,
  fee_lamports bigint not null,
  tx_sig text
);

create index if not exists fee_events_timestamp_idx on fee_events (timestamp desc);
create index if not exists fee_events_user_pubkey_idx on fee_events (user_pubkey);

-- Row-level security: allow insert from anon key
alter table trades enable row level security;
alter table fee_events enable row level security;

create policy "Allow anon insert on trades"
  on trades for insert
  to anon
  with check (true);

create policy "Allow anon insert on fee_events"
  on fee_events for insert
  to anon
  with check (true);

-- (Service role can read all for analytics)
