-- Chess Private Student Planner — paid lessons
-- Run this after 0010_student_rate.sql. Additive; safe to re-run.

-- A lesson marked paid. Lessons aren't stored one by one (they come from the
-- regular week and its changes), so each is named by a key: its regular
-- slot and the date it was due ("<slot id>:<YYYY-MM-DD>", which a move
-- doesn't change), or "extra:<change id>" for a one-off. amount is the fee
-- when it was marked, so a later rate change leaves past payments alone.
create table if not exists lesson_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  lesson_key text not null,
  lesson_date date not null,
  amount numeric(8, 2) check (amount is null or amount >= 0),
  paid_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, lesson_key)
);

alter table lesson_payments enable row level security;

drop policy if exists "lesson_payments are owned by their user" on lesson_payments;
create policy "lesson_payments are owned by their user" on lesson_payments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';
