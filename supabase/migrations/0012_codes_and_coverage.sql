-- Chess Private Student Planner — more codes, and what's been covered
-- Run this after 0011_lesson_payments.sql. Additive; safe to re-run.

-- Codes beyond the front door and the one bathroom: each a label and a
-- code, e.g. {"label": "Chick-fil-A bathroom", "code": "19-18-07"}.
alter table student_places add column if not exists extra_codes jsonb not null default '[]'::jsonb;

-- Whether a position has been gone over with the student: the same red,
-- yellow, green dot as a lesson's own status.
alter table puzzles add column if not exists status text not null default 'planned';
alter table puzzles drop constraint if exists puzzles_status_check;
alter table puzzles add constraint puzzles_status_check
  check (status in ('planned', 'in_progress', 'taught'));

notify pgrst, 'reload schema';
