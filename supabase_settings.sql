-- Выполните в Supabase → SQL Editor (после supabase_tasks.sql)

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.task_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  color text,
  created_at timestamptz not null default now(),
  constraint task_types_name_unique unique (name)
);

alter table public.task_types add column if not exists color text;

insert into public.task_types (name, sort_order)
select v.name, v.ord
from (
  values
    ('Звонок', 1),
    ('Встреча', 2),
    ('Отчёт', 3),
    ('Документы', 4),
    ('Прочее', 5)
) as v(name, ord)
on conflict (name) do nothing;

alter table public.clients enable row level security;
alter table public.task_types enable row level security;

drop policy if exists "clients_select" on public.clients;
drop policy if exists "clients_insert" on public.clients;
drop policy if exists "clients_update" on public.clients;
drop policy if exists "clients_delete" on public.clients;

create policy "clients_select" on public.clients for select using (true);
create policy "clients_insert" on public.clients for insert with check (true);
create policy "clients_update" on public.clients for update using (true);
create policy "clients_delete" on public.clients for delete using (true);

drop policy if exists "task_types_select" on public.task_types;
drop policy if exists "task_types_insert" on public.task_types;
drop policy if exists "task_types_update" on public.task_types;
drop policy if exists "task_types_delete" on public.task_types;

create policy "task_types_select" on public.task_types for select using (true);
create policy "task_types_insert" on public.task_types for insert with check (true);
create policy "task_types_update" on public.task_types for update using (true);
create policy "task_types_delete" on public.task_types for delete using (true);
