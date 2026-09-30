-- Daily Recess metrics rollup via pg_cron.
-- Run this in the SQL editor AFTER the project is Active and 002 has been applied.
-- Dashboard: Database → Extensions → enable pg_cron if it is not already on.

create extension if not exists pg_cron;

create or replace function public.recess_rollup_for_date(target date)
returns public.daily_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  mix text;
  rec public.daily_reports;
begin
  select string_agg(game_type || ':' || cnt::text, ', ' order by cnt desc)
    into mix
  from (
    select game_type, count(*)::bigint as cnt
    from public.games
    where to_timestamp(created_at / 1000.0)::date = target
    group by game_type
  ) s;

  insert into public.daily_reports (
    report_date,
    rooms_created,
    rooms_completed,
    rooms_abandoned,
    moves,
    would_play_again,
    notes
  )
  select
    target,
    (select count(*) from public.games
      where to_timestamp(created_at / 1000.0)::date = target),
    (select count(*) from public.games
      where status = 'completed'
        and to_timestamp(updated_at / 1000.0)::date = target),
    (select count(*) from public.games
      where status = 'abandoned'
        and to_timestamp(updated_at / 1000.0)::date = target),
    (select count(*) from public.moves
      where to_timestamp(created_at / 1000.0)::date = target),
    (select count(*) from public.feedback
      where would_play_again is true
        and to_timestamp(created_at / 1000.0)::date = target),
    concat_ws(
      ' | ',
      'pg_cron rollup',
      nullif(mix, '')
    )
  on conflict (report_date) do update set
    rooms_created = excluded.rooms_created,
    rooms_completed = excluded.rooms_completed,
    rooms_abandoned = excluded.rooms_abandoned,
    moves = excluded.moves,
    would_play_again = excluded.would_play_again,
    notes = excluded.notes
  returning * into rec;

  return rec;
end;
$$;

create or replace function public.recess_daily_rollup()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Yesterday is a complete day; today is a live snapshot for the dashboard.
  perform public.recess_rollup_for_date((timezone('utc', now()))::date - 1);
  perform public.recess_rollup_for_date((timezone('utc', now()))::date);
end;
$$;

grant execute on function public.recess_rollup_for_date(date) to postgres;
grant execute on function public.recess_daily_rollup() to postgres;

-- Replace any previous job with the same name.
select cron.unschedule(jobid)
from cron.job
where jobname = 'recess-daily-rollup';

select cron.schedule(
  'recess-daily-rollup',
  '15 7 * * *',
  $$select public.recess_daily_rollup();$$
);
