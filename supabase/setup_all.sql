-- Chess Private Student Planner — ALL migrations in one file.
-- Paste the whole thing into the Supabase SQL Editor and click Run, once.
-- Safe to re-run: every statement is additive / IF NOT EXISTS.

-- ===================== 0001_init.sql =====================
-- Chess Private Student Planner — initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#f0b429',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table students enable row level security;

create policy "students are owned by their creator" on students
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- lesson_plans
-- ---------------------------------------------------------------------------
create table if not exists lesson_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  number integer not null,
  title text not null default '',
  agenda text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, number)
);

alter table lesson_plans enable row level security;

create policy "lesson_plans follow parent student" on lesson_plans
  for all
  using (exists (
    select 1 from students
    where students.id = lesson_plans.student_id
      and students.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from students
    where students.id = lesson_plans.student_id
      and students.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- lesson_sections
-- ---------------------------------------------------------------------------
create table if not exists lesson_sections (
  id uuid primary key default gen_random_uuid(),
  lesson_plan_id uuid not null references lesson_plans (id) on delete cascade,
  title text not null default '',
  sort_order integer not null default 0
);

alter table lesson_sections enable row level security;

create policy "lesson_sections follow parent lesson plan" on lesson_sections
  for all
  using (exists (
    select 1 from lesson_plans
    join students on students.id = lesson_plans.student_id
    where lesson_plans.id = lesson_sections.lesson_plan_id
      and students.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from lesson_plans
    join students on students.id = lesson_plans.student_id
    where lesson_plans.id = lesson_sections.lesson_plan_id
      and students.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- puzzles
-- ---------------------------------------------------------------------------
create table if not exists puzzles (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references lesson_sections (id) on delete cascade,
  sort_order integer not null default 0,
  label text not null default '',
  starting_fen text not null default 'start',
  side_to_move text not null default 'w' check (side_to_move in ('w', 'b')),
  arrows jsonb not null default '[]'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  quiz_prompt text not null default '',
  summary text not null default '',
  solution jsonb not null default '[]'::jsonb,
  reference_url text,
  reference_label text
);

alter table puzzles enable row level security;

create policy "puzzles follow parent lesson section" on puzzles
  for all
  using (exists (
    select 1 from lesson_sections
    join lesson_plans on lesson_plans.id = lesson_sections.lesson_plan_id
    join students on students.id = lesson_plans.student_id
    where lesson_sections.id = puzzles.section_id
      and students.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from lesson_sections
    join lesson_plans on lesson_plans.id = lesson_sections.lesson_plan_id
    join students on students.id = lesson_plans.student_id
    where lesson_sections.id = puzzles.section_id
      and students.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- notes (MISC / Game Review / Invoices / Student Notes)
-- ---------------------------------------------------------------------------
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  folder_kind text not null check (folder_kind in ('misc', 'game_review', 'invoices', 'student_notes')),
  title text not null default '',
  body text not null default '',
  amount numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notes enable row level security;

create policy "notes follow parent student" on notes
  for all
  using (exists (
    select 1 from students
    where students.id = notes.student_id
      and students.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from students
    where students.id = notes.student_id
      and students.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger lesson_plans_set_updated_at
  before update on lesson_plans
  for each row execute function set_updated_at();

create trigger notes_set_updated_at
  before update on notes
  for each row execute function set_updated_at();

-- ===================== 0002_user_settings.sql =====================
-- Chess Private Student Planner — per-account preferences
-- Run this after 0001_init.sql.

create table if not exists user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  piece_set text not null default 'classic' check (piece_set in ('classic', 'arcade', 'wavy')),
  updated_at timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "user_settings are owned by their user" on user_settings
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger user_settings_set_updated_at
  before update on user_settings
  for each row execute function set_updated_at();

-- ===================== 0003_sources_and_themes.sql =====================
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


-- ===================== 0004_lesson_flow.sql =====================
-- Chess Private Student Planner — faster lesson set-up
-- Run this after 0003_sources_and_themes.sql. Additive; safe to re-run.

-- A lesson's lifecycle, tapped through on the lesson page:
-- planned → in_progress → taught. taught_on is stamped when it reaches taught.
alter table lesson_plans add column if not exists status text not null default 'planned';
alter table lesson_plans drop constraint if exists lesson_plans_status_check;
alter table lesson_plans add constraint lesson_plans_status_check
  check (status in ('planned', 'in_progress', 'taught'));
alter table lesson_plans add column if not exists taught_on date;

-- A saved lesson shape: the section titles and agenda a new lesson starts
-- from, so a recurring format is one tap instead of re-typed.
create table if not exists lesson_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  theme text not null default '',
  sections text[] not null default '{}',
  agenda text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table lesson_templates enable row level security;

drop policy if exists "lesson_templates are owned by their user" on lesson_templates;
create policy "lesson_templates are owned by their user" on lesson_templates
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===================== 0005_skins.sql =====================
-- Chess Private Student Planner — skins
-- Run this after 0004_lesson_flow.sql. Additive; safe to re-run.

-- Which look the coach chose: 'folder' (the default) or one of the Chess
-- Arcade skins (felt, hustler, bauhaus, gameboy, outerspace).
alter table user_settings add column if not exists skin text not null default 'folder';

-- ===================== 0006_puzzle_done.sql =====================
-- Chess Private Student Planner — annotation queue
-- Run this after 0005_skins.sql. Additive; safe to re-run.

-- A position is "done" once the coach has saved its annotation in the
-- workbench; the queue shows what's left.
alter table puzzles add column if not exists done boolean not null default false;

-- ===================== 0007_student_logo.sql =====================
-- Chess Private Student Planner — school logos
-- Run this after 0006_puzzle_done.sql. Additive; safe to re-run.

-- A student's school badge: a path to a built-in logo (/logos/buckley.png)
-- or a small image the coach uploaded, stored as a data URL.
alter table students add column if not exists logo text;
