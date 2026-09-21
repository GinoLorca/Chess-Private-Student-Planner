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
