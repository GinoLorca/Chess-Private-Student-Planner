-- Chess Private Student Planner — your own notes on each position
-- Run this after 0012_codes_and_coverage.sql. Additive; safe to re-run.

-- What the coach found solving the position by hand: other tries, traps,
-- what to ask the student. Shown under the explanation on the position page
-- and in Coach view, never to the student.
alter table puzzles add column if not exists coach_notes text not null default '';

notify pgrst, 'reload schema';
