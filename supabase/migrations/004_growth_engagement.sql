-- Recess growth schema. Run after 002 and 003 when the project is Active.
-- V2 coin/wager tables exist but stay unused until feature_flags.v2_economy = true.

alter table public.daily_reports
  add column if not exists pvp_rooms bigint not null default 0,
  add column if not exists coop_rooms bigint not null default 0,
  add column if not exists vs_ai_rooms bigint not null default 0,
  add column if not exists unique_devices bigint not null default 0,
  add column if not exists streak_plays bigint not null default 0,
  add column if not exists feedback_notes bigint not null default 0;

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  note text,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (key, enabled, note) values
  ('v2_economy', false, 'Coins, wagers, checkout — hidden until explicitly enabled'),
  ('google_oauth', false, 'Enable after Google provider is configured in Auth'),
  ('team_modes', false, 'Team vs team rooms beyond 1v1')
on conflict (key) do nothing;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  device_token text unique,
  display_name text,
  high_score integer not null default 0,
  coins integer not null default 0,
  signup_bonus_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_sessions (
  id uuid primary key default gen_random_uuid(),
  slug text,
  game_type text not null,
  mode text not null check (mode in ('pvp', 'coop', 'team_v_team', 'vs_ai')),
  ai_profile text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  device_token text,
  rating smallint check (rating between 1 and 5),
  body text not null,
  created_at timestamptz not null default now()
);

-- Virtual coins only. Do not wire real-money settlement until legal review.
create table if not exists public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.wagers (
  id uuid primary key default gen_random_uuid(),
  slug text,
  stake integer not null check (stake > 0),
  status text not null default 'locked_v2',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.match_sessions enable row level security;
alter table public.app_feedback enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.wagers enable row level security;
alter table public.feature_flags enable row level security;

drop policy if exists "feedback_insert" on public.app_feedback;
create policy "feedback_insert" on public.app_feedback for insert with check (true);
drop policy if exists "flags_read" on public.feature_flags;
create policy "flags_read" on public.feature_flags for select using (true);
