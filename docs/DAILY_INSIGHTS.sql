-- Recess daily snapshot. Run in SQL editor or wire to a scheduled Edge job.
-- Paste results into docs or email.

insert into public.daily_reports (
  report_date, rooms_created, rooms_completed, rooms_abandoned, moves, would_play_again, notes
)
select
  current_date,
  (select count(*) from public.games where to_timestamp(created_at / 1000.0)::date = current_date),
  (select count(*) from public.games where status = 'completed' and to_timestamp(updated_at / 1000.0)::date = current_date),
  (select count(*) from public.games where status = 'abandoned' and to_timestamp(updated_at / 1000.0)::date = current_date),
  (select count(*) from public.moves where to_timestamp(created_at / 1000.0)::date = current_date),
  (select count(*) from public.feedback where would_play_again is true and to_timestamp(created_at / 1000.0)::date = current_date),
  'Auto snapshot'
on conflict (report_date) do update set
  rooms_created = excluded.rooms_created,
  rooms_completed = excluded.rooms_completed,
  rooms_abandoned = excluded.rooms_abandoned,
  moves = excluded.moves,
  would_play_again = excluded.would_play_again;

select * from public.daily_reports order by report_date desc limit 14;
