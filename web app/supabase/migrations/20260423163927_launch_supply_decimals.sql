alter table public.launched_tokens
  add column if not exists requested_supply numeric not null default 1000000000,
  add column if not exists requested_decimals integer not null default 6;

comment on column public.launched_tokens.requested_supply is 'User-requested total supply captured by Axyrion metadata/history.';
comment on column public.launched_tokens.requested_decimals is 'User-requested decimals captured by Axyrion metadata/history.';
