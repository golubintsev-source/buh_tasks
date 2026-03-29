-- Выполните в Supabase → SQL Editor

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  task_text text not null default '',
  client_name text,
  phone text,
  email text,
  task_type text,
  deadline timestamptz,
  closed boolean not null default false
);

alter table public.tasks add column if not exists task_text text;
alter table public.tasks add column if not exists client_name text;
alter table public.tasks add column if not exists phone text;
alter table public.tasks add column if not exists email text;
alter table public.tasks add column if not exists task_type text;
alter table public.tasks add column if not exists deadline timestamptz;
alter table public.tasks add column if not exists closed boolean;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'title'
  ) then
    execute $m$
      update public.tasks
      set task_text = coalesce(nullif(trim(task_text), ''), trim(title))
      where task_text is null or trim(task_text) = ''
    $m$;
  end if;
end $$;

update public.tasks set task_text = '—' where task_text is null or trim(task_text) = '';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'done'
  ) then
    execute 'update public.tasks set closed = coalesce(closed, done) where closed is null';
  end if;
end $$;

update public.tasks set closed = false where closed is null;

alter table public.tasks alter column task_text set not null;
alter table public.tasks alter column closed set not null;

alter table public.tasks enable row level security;

drop policy if exists "tasks_select" on public.tasks;
drop policy if exists "tasks_insert" on public.tasks;
drop policy if exists "tasks_update" on public.tasks;
drop policy if exists "tasks_delete" on public.tasks;

create policy "tasks_select" on public.tasks for select using (true);
create policy "tasks_insert" on public.tasks for insert with check (true);
create policy "tasks_update" on public.tasks for update using (true);
create policy "tasks_delete" on public.tasks for delete using (true);
