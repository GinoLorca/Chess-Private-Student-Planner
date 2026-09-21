-- Chess Private Student Planner — skins
-- Run this after 0004_lesson_flow.sql. Additive; safe to re-run.

-- Which look the coach chose: 'folder' (the default) or one of the Chess
-- Arcade skins (felt, hustler, bauhaus, gameboy, outerspace).
alter table user_settings add column if not exists skin text not null default 'folder';
