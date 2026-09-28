-- Chess Private Student Planner — the schedule
-- Run this after 0008_student_uscf.sql. Additive; safe to re-run.

-- A student's regular weekly lesson: every <weekday> at <start_time>.
-- Times are the coach's local wall-clock time ("16:30"), with no time zone.
create table if not exists schedule_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time text not null check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  duration_min integer not null default 60 check (duration_min between 5 and 600),
  created_at timestamptz not null default now()
);

-- One week's exception: a regular lesson cancelled or moved on one date, or a
-- one-off extra lesson (slot_id null). The regular slot itself never changes.
create table if not exists schedule_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slot_id uuid references schedule_slots (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  kind text not null check (kind in ('cancelled', 'moved', 'extra')),
  original_date date,
  new_date date,
  new_time text check (new_time is null or new_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  duration_min integer check (duration_min is null or duration_min between 5 and 600),
  note text not null default '',
  created_at timestamptz not null default now(),
  -- One change per regular lesson per date. Extras (slot_id null) never clash.
  unique (slot_id, original_date)
);

-- A to-do written when the week changes, to hand on to Apple Reminders.
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id uuid references students (id) on delete cascade,
  change_id uuid references schedule_changes (id) on delete cascade,
  title text not null,
  notes text not null default '',
  due_at timestamptz,
  done boolean not null default false,
  shared_at timestamptz,
  created_at timestamptz not null default now()
);

-- Where a student's lessons happen and the codes to get in: one row per student.
create table if not exists student_places (
  student_id uuid primary key references students (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  address text not null default '',
  door_code text not null default '',
  bathroom_code text not null default '',
  bathroom_note text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now()
);

alter table schedule_slots enable row level security;
alter table schedule_changes enable row level security;
alter table reminders enable row level security;
alter table student_places enable row level security;

drop policy if exists "schedule_slots are owned by their user" on schedule_slots;
create policy "schedule_slots are owned by their user" on schedule_slots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "schedule_changes are owned by their user" on schedule_changes;
create policy "schedule_changes are owned by their user" on schedule_changes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "reminders are owned by their user" on reminders;
create policy "reminders are owned by their user" on reminders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "student_places are owned by their user" on student_places;
create policy "student_places are owned by their user" on student_places
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Ask PostgREST to pick up the new tables straight away.
notify pgrst, 'reload schema';
