-- Each signed-in user's saved office: one row per setting (tasks, agents, XP, theme, ...).
-- The value is the exact string the app keeps in localStorage, so it round-trips unchanged.
create table if not exists public.user_state (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (key ~ '^office\.[a-z.]{1,40}$'),
  value text not null check (octet_length(value) <= 5000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Row level security: people can only ever see and change their own rows.
alter table public.user_state enable row level security;

drop policy if exists "Read own state" on public.user_state;
create policy "Read own state" on public.user_state
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Add own state" on public.user_state;
create policy "Add own state" on public.user_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Change own state" on public.user_state;
create policy "Change own state" on public.user_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Remove own state" on public.user_state;
create policy "Remove own state" on public.user_state
  for delete to authenticated using ((select auth.uid()) = user_id);

-- keep updated_at current on every change
create or replace function public.touch_user_state() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_user_state on public.user_state;
create trigger touch_user_state before update on public.user_state
  for each row execute function public.touch_user_state();
