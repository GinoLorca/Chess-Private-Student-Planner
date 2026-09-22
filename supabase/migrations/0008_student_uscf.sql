-- Chess Private Student Planner — USCF membership
-- Run once in the Supabase SQL editor (safe to re-run).
--
-- A student's USCF ID. The app looks the live rating up from it (through
-- its own /api/uscf function) and shows it on the folder.
alter table students add column if not exists uscf_id text;
