-- Chess Private Student Planner — puzzle sources, lesson themes, visual themes
-- Run this after 0002_user_settings.sql. Every change here is additive: existing
-- rows keep working unchanged.

-- Where a position came from (Lichess puzzle/study/game, Chess.com game, a
-- screenshot, a paste…) and any tactical theme tags it carries.
alter table puzzles add column if not exists source jsonb;
alter table puzzles add column if not exists themes text[] not null default '{}';

-- Multi-week theme blocks ("Endgames — October").
alter table lesson_plans add column if not exists theme text not null default '';

-- Usernames let Quick Add look up the coach's own games; board_theme is a
-- preset id or 'custom' with the colours in custom_board.
alter table user_settings add column if not exists lichess_username text not null default '';
alter table user_settings add column if not exists chesscom_username text not null default '';
alter table user_settings add column if not exists board_theme text not null default 'brown';
alter table user_settings add column if not exists custom_board jsonb;

-- Imported piece sets: 12 images (data URLs) keyed wK…bP. A single coach's
-- handful of sets is small enough to live in a row and travel with the cache.
create table if not exists custom_piece_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  images jsonb not null,
  created_at timestamptz not null default now()
);

alter table custom_piece_sets enable row level security;

create policy "custom_piece_sets are owned by their user" on custom_piece_sets
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- piece_set can now also be 'custom:<uuid>'.
alter table user_settings drop constraint if exists user_settings_piece_set_check;
