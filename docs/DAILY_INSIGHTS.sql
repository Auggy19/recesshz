-- Recess daily snapshot.
-- After 003_pg_cron_daily_rollup.sql is applied, prefer:

select public.recess_daily_rollup();
select * from public.daily_reports order by report_date desc limit 14;

-- Manual one-day rebuild:
-- select public.recess_rollup_for_date('2026-09-29');

-- Inspect the cron job:
-- select jobid, jobname, schedule, command, active from cron.job;
-- select * from cron.job_run_details order by start_time desc limit 20;
