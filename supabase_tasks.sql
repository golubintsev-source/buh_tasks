-- Выполните в Supabase → SQL Editor → New query → Run

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

-- Для учебного проекта: анонимный ключ может всё (потом сузьте политики под роли).
create policy "tasks_select" on public.tasks for select using (true);
create policy "tasks_insert" on public.tasks for insert with check (true);
create policy "tasks_update" on public.tasks for update using (true);
create policy "tasks_delete" on public.tasks for delete using (true);
