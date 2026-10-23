-- Chess Private Student Planner — the Teach folder, and De-Construct levels
-- Run this after 0013_coach_notes.sql. Additive; safe to re-run.

-- Teach: lessons for teaching anyone, built from students' positions with the
-- student taken out. It's a folder like a student's (so its lessons, Present,
-- Coach view and Learn are the same pages), marked so it never shows among the
-- students, on the Schedule or in invoices.
alter table students add column if not exists kind text not null default 'student';

-- De-Construct: a position's easier versions (Beginner and Intermediate, the
-- original being Advanced), each its own set-up, answer and wording.
alter table puzzles add column if not exists levels jsonb;

notify pgrst, 'reload schema';
