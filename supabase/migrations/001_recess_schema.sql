-- Recess schema (migrated from Convex)
-- Run in Supabase SQL editor or via supabase db push

create extension if not exists "pgcrypto";

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  game_type text not null,
  state jsonb not null default '{}'::jsonb,
  status text not null check (status in ('waiting', 'in_progress', 'completed', 'abandoned')),
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists games_by_slug on public.games (slug);
create index if not exists games_by_status on public.games (status);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  device_token text not null,
  role text not null check (role in ('initiator', 'responder')),
  marker text not null check (marker in ('X', 'O')),
  joined_at bigint not null,
  unique (game_id, device_token)
);

create index if not exists players_by_game on public.players (game_id);
create index if not exists players_by_game_device on public.players (game_id, device_token);

create table if not exists public.moves (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at bigint not null
);

create index if not exists moves_by_game on public.moves (game_id);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  felt_natural boolean,
  would_play_again boolean,
  created_at bigint not null
);

create index if not exists feedback_by_game on public.feedback (game_id);

alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.moves enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "games_all" on public.games;
create policy "games_all" on public.games for all using (true) with check (true);

drop policy if exists "players_all" on public.players;
create policy "players_all" on public.players for all using (true) with check (true);

drop policy if exists "moves_all" on public.moves;
create policy "moves_all" on public.moves for all using (true) with check (true);

drop policy if exists "feedback_all" on public.feedback;
create policy "feedback_all" on public.feedback for all using (true) with check (true);

alter publication supabase_realtime add table public.games;
