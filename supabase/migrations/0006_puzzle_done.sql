-- Chess Private Student Planner — annotation queue
-- Run this after 0005_skins.sql. Additive; safe to re-run.

-- A position is "done" once the coach has saved its annotation in the
-- workbench; the queue shows what's left.
alter table puzzles add column if not exists done boolean not null default false;
