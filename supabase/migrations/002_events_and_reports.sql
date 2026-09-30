-- Aggregated interaction events + daily report snapshots.
-- Run in the SQL editor after the project is Active.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  game_type text,
  slug text,
  device_token text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_by_created on public.events (created_at desc);
create index if not exists events_by_name on public.events (name);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null unique,
  rooms_created bigint not null default 0,
  rooms_completed bigint not null default 0,
  rooms_abandoned bigint not null default 0,
  moves bigint not null default 0,
  would_play_again bigint not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.daily_reports enable row level security;

-- Writes go through Edge (service role). Public read of reports is optional later.
drop policy if exists "events_insert_anon" on public.events;
create policy "events_insert_anon" on public.events for insert with check (true);

drop policy if exists "reports_read" on public.daily_reports;
create policy "reports_read" on public.daily_reports for select using (true);
