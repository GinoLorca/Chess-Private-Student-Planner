-- Chess Private Student Planner — school logos
-- Run this after 0006_puzzle_done.sql. Additive; safe to re-run.

-- A student's school badge: a path to a built-in logo (/logos/buckley.png)
-- or a small image the coach uploaded, stored as a data URL.
alter table students add column if not exists logo text;
