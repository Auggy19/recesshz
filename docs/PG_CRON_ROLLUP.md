# pg_cron daily rollups (Recess)

## What it does

Every day at **07:15 UTC**, Postgres runs `public.recess_daily_rollup()`:

- Upserts **yesterday** (complete day)
- Upserts **today** (partial, for a live board)
- Stores mix of `game_type` counts in `daily_reports.notes`

No Edge Function is required for the rollup itself. Keep Edge for move authority and optional event ingest.

## Apply (once the project is Active)

1. Resume the Supabase project if it is paused. Cron does not run while paused.
2. Enable **pg_cron**: Dashboard → Database → Extensions.
3. Run `supabase/migrations/002_events_and_reports.sql` if `daily_reports` does not exist.
4. Run `supabase/migrations/003_pg_cron_daily_rollup.sql` in the SQL editor.
5. Smoke test:

```sql
select public.recess_daily_rollup();
select * from public.daily_reports order by report_date desc;
select jobid, jobname, schedule, command from cron.job;
```

## How to read the snapshot

| Signal | Action |
|--------|--------|
| `rooms_abandoned` high vs created | Invite / join friction or 48h expiry |
| One `game_type` dominates notes | Feature that game on the home hero |
| `would_play_again` near zero | Post-match prompt or rules copy |
| All zeros | Project was paused or no traffic |

## Unschedule

```sql
select cron.unschedule(jobid) from cron.job where jobname = 'recess-daily-rollup';
```
