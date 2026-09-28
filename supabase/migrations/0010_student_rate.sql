-- Chess Private Student Planner — hourly rates
-- Run this after 0009_schedule.sql. Additive; safe to re-run.

-- A student's hourly rate, in dollars. Each lesson's fee is the rate times
-- its length; the Schedule totals them for the week and the month.
alter table student_places add column if not exists hourly_rate numeric(8, 2)
  check (hourly_rate is null or hourly_rate >= 0);

notify pgrst, 'reload schema';
