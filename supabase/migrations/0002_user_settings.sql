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
