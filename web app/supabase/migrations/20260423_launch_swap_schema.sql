create extension if not exists pgcrypto;

create table if not exists public.launched_tokens (
  id uuid primary key default gen_random_uuid(),
  creator_wallet text not null,
  provider text not null check (provider in ('bags', 'pumpfun')),
  token_name text not null,
  token_symbol text not null,
  mint_address text not null unique,
  description text not null default '',
  image_url text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,
  metadata_storage_provider text not null default 'supabase',
  metadata_public_url text not null default '',
  twitter_url text not null default '',
  telegram_url text not null default '',
  website_url text not null default '',
  discord_url text not null default '',
  tx_signature text not null,
  initial_buy_enabled boolean not null default false,
  initial_buy_amount numeric,
  initial_buy_denomination text,
  initial_buy_tx_signature text,
  total_launch_cost numeric,
  launch_status text not null default 'confirmed' check (launch_status in ('confirmed', 'partial', 'failed')),
  created_at timestamptz not null default timezone('utc', now()),
  raw_provider_response jsonb not null default '{}'::jsonb
);

create index if not exists launched_tokens_creator_wallet_idx on public.launched_tokens (creator_wallet, created_at desc);
create index if not exists launched_tokens_provider_idx on public.launched_tokens (provider, created_at desc);

create table if not exists public.token_launch_events (
  id uuid primary key default gen_random_uuid(),
  mint_address text not null,
  provider text not null check (provider in ('bags', 'pumpfun')),
  event_type text not null check (event_type in (
    'launch_submitted',
    'launch_confirmed',
    'initial_buy_submitted',
    'initial_buy_confirmed',
    'metadata_uploaded',
    'metadata_saved'
  )),
  tx_signature text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists token_launch_events_mint_idx on public.token_launch_events (mint_address, created_at desc);

create table if not exists public.swap_history (
  id uuid primary key default gen_random_uuid(),
  user_wallet text not null,
  input_mint text not null,
  output_mint text not null,
  input_symbol text not null,
  output_symbol text not null,
  input_amount numeric not null,
  output_amount numeric not null,
  tx_signature text not null,
  route_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists swap_history_user_wallet_idx on public.swap_history (user_wallet, created_at desc);

alter table public.launched_tokens enable row level security;
alter table public.token_launch_events enable row level security;
alter table public.swap_history enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'launched_tokens' and policyname = 'Users can read launched tokens'
  ) then
    create policy "Users can read launched tokens"
      on public.launched_tokens
      for select
      to authenticated, anon
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'launched_tokens' and policyname = 'Users can insert their own launched tokens'
  ) then
    create policy "Users can insert their own launched tokens"
      on public.launched_tokens
      for insert
      to authenticated
      with check (creator_wallet = auth.uid()::text);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'token_launch_events' and policyname = 'Users can read launch events'
  ) then
    create policy "Users can read launch events"
      on public.token_launch_events
      for select
      to authenticated, anon
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'token_launch_events' and policyname = 'Users can insert launch events for their own tokens'
  ) then
    create policy "Users can insert launch events for their own tokens"
      on public.token_launch_events
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.launched_tokens lt
          where lt.mint_address = token_launch_events.mint_address
            and lt.creator_wallet = auth.uid()::text
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'swap_history' and policyname = 'Users can read their own swap history'
  ) then
    create policy "Users can read their own swap history"
      on public.swap_history
      for select
      to authenticated
      using (user_wallet = auth.uid()::text);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'swap_history' and policyname = 'Users can insert their own swap history'
  ) then
    create policy "Users can insert their own swap history"
      on public.swap_history
      for insert
      to authenticated
      with check (user_wallet = auth.uid()::text);
  end if;
end $$;

comment on table public.launched_tokens is 'Canonical Axyrion metadata and launch records for user-created tokens.';
comment on table public.token_launch_events is 'Append-only launch lifecycle events for token creation and optional initial buy.';
comment on table public.swap_history is 'User swap history persisted after confirmed Jupiter swaps.';
