-- ═══════════════════════════════════════════════════════════════════════════════
-- SniperShot — Complete Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to re-run (all statements use IF NOT EXISTS / OR REPLACE / DO NOTHING)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── 1. TOKENS ───────────────────────────────────────────────────────────────
create table if not exists tokens (
  mint                text primary key,
  name                text,
  symbol              text,
  image_uri           text,
  description         text,
  creator_address     text,
  market_cap          numeric default 0,
  usd_market_cap      numeric default 0,
  sol_in_curve        numeric default 0,
  complete            boolean default false,
  twitter_url         text default '',
  telegram_url        text default '',
  website_url         text default '',
  total_supply        numeric default 0,
  created_timestamp   timestamptz,
  first_seen_at       timestamptz default now(),
  -- Creator dump tracking
  creator_dumped      boolean default false,
  creator_dump_pct    numeric,
  creator_dump_at     timestamptz
);

create index if not exists tokens_created_at_idx on tokens (created_timestamp desc);
create index if not exists tokens_first_seen_idx on tokens (first_seen_at desc);

alter table tokens enable row level security;

drop policy if exists "anon_read_tokens"   on tokens;
drop policy if exists "anon_insert_tokens" on tokens;
drop policy if exists "anon_update_tokens" on tokens;

create policy "anon_read_tokens"   on tokens for select using (true);
create policy "anon_insert_tokens" on tokens for insert with check (true);
create policy "anon_update_tokens" on tokens for update using (true);


-- ─── 2. WALLETS (encrypted keypair backup) ───────────────────────────────────
create table if not exists wallets (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  public_key            text,
  encrypted_private_key text not null,
  updated_at            timestamptz default now()
);

alter table wallets enable row level security;

drop policy if exists "wallet_owner_only" on wallets;

create policy "wallet_owner_only" on wallets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ─── 3. PROFILES ─────────────────────────────────────────────────────────────
create table if not exists profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text,
  avatar_url text,
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "profile_owner_all"   on profiles;
drop policy if exists "profile_public_read" on profiles;

create policy "profile_owner_all"   on profiles for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profile_public_read" on profiles for select using (true);


-- ─── 4. WATCHLIST ────────────────────────────────────────────────────────────
create table if not exists watchlist (
  mint         text primary key,
  token_name   text,
  token_symbol text,
  image_uri    text,
  added_at     timestamptz default now()
);

alter table watchlist enable row level security;

drop policy if exists "anon_all_watchlist" on watchlist;

create policy "anon_all_watchlist" on watchlist
  for all using (true) with check (true);


-- ─── 5. TOKEN VOTES ──────────────────────────────────────────────────────────
create table if not exists token_votes (
  id         bigserial primary key,
  mint       text not null,
  user_id    text not null,
  vote       text check (vote in ('up', 'down')),
  created_at timestamptz default now(),
  unique (mint, user_id)
);

create index if not exists token_votes_mint_idx on token_votes (mint);

alter table token_votes enable row level security;

drop policy if exists "anon_all_votes" on token_votes;

create policy "anon_all_votes" on token_votes
  for all using (true) with check (true);


-- ─── 6. TRADES ───────────────────────────────────────────────────────────────
create table if not exists trades (
  id              text primary key,
  timestamp       timestamptz not null default now(),
  user_pubkey     text not null,
  token_mint      text not null,
  token_name      text,
  token_symbol    text,
  type            text not null check (type in ('buy', 'sell')),
  amount_sol      numeric not null,
  amount_tokens   numeric not null,
  price_per_token numeric,
  tx_sig          text,
  fee_lamports    bigint
);

create index if not exists trades_user_pubkey_idx on trades (user_pubkey);
create index if not exists trades_timestamp_idx   on trades (timestamp desc);
create index if not exists trades_token_mint_idx  on trades (token_mint);

alter table trades enable row level security;

drop policy if exists "anon_insert_trades" on trades;
drop policy if exists "anon_read_trades"   on trades;

create policy "anon_insert_trades" on trades for insert with check (true);
create policy "anon_read_trades"   on trades for select using (true);


-- ─── 7. FEE EVENTS ───────────────────────────────────────────────────────────
create table if not exists fee_events (
  id           bigserial primary key,
  timestamp    timestamptz not null default now(),
  user_pubkey  text not null,
  token_mint   text not null,
  fee_lamports bigint not null,
  tx_sig       text
);

create index if not exists fee_events_timestamp_idx  on fee_events (timestamp desc);
create index if not exists fee_events_user_pubkey_idx on fee_events (user_pubkey);

alter table fee_events enable row level security;

drop policy if exists "anon_insert_fee_events" on fee_events;

create policy "anon_insert_fee_events" on fee_events for insert with check (true);


-- ─── 8. STORAGE — profiles bucket ────────────────────────────────────────────
-- Creates the bucket if it doesn't exist (idempotent)
insert into storage.buckets (id, name, public)
  values ('profiles', 'profiles', true)
  on conflict (id) do nothing;

drop policy if exists "profiles_public_read"   on storage.objects;
drop policy if exists "profiles_auth_upload"   on storage.objects;
drop policy if exists "profiles_auth_update"   on storage.objects;
drop policy if exists "profiles_auth_delete"   on storage.objects;

create policy "profiles_public_read" on storage.objects
  for select using (bucket_id = 'profiles');

create policy "profiles_auth_upload" on storage.objects
  for insert with check (bucket_id = 'profiles' and auth.role() = 'authenticated');

create policy "profiles_auth_update" on storage.objects
  for update using (bucket_id = 'profiles' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "profiles_auth_delete" on storage.objects
  for delete using (bucket_id = 'profiles' and auth.uid()::text = (storage.foldername(name))[1]);


-- ─── 9. AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─── Done ─────────────────────────────────────────────────────────────────────
-- Tables: tokens, wallets, profiles, watchlist, token_votes, trades, fee_events
-- Storage: profiles bucket (public read, auth upload)
-- Trigger: auto-creates profile row on user signup
