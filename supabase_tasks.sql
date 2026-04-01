-- Выполните в Supabase → SQL Editor

create sequence if not exists public.tasks_task_number_seq;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  task_text text not null default '',
  client_name text,
  phone text,
  task_type text,
  deadline timestamptz,
  closed boolean not null default false
);

alter table public.tasks add column if not exists task_text text;
alter table public.tasks add column if not exists client_name text;
alter table public.tasks add column if not exists phone text;
alter table public.tasks add column if not exists task_type text;
alter table public.tasks add column if not exists deadline timestamptz;
alter table public.tasks add column if not exists closed boolean;
alter table public.tasks add column if not exists title text;
alter table public.tasks add column if not exists task_number integer;

alter table public.tasks drop column if exists email;

-- Если раньше создали триггер без колонки — убираем, иначе INSERT падает с «new has no field task_number»
drop trigger if exists tasks_assign_task_number on public.tasks;
drop function if exists public.tasks_assign_task_number();

-- Порядковый номер задачи (автоинкремент; только для строк без номера)
update public.tasks t
set task_number = numbered.new_no
from (
  with mx as (select coalesce(max(task_number), 0) as m from public.tasks)
  select
    t.id,
    mx.m + row_number() over (order by t.created_at asc, t.id asc) as new_no
  from public.tasks t
  cross join mx
  where t.task_number is null
) numbered
where t.id = numbered.id;

select setval(
  'public.tasks_task_number_seq',
  coalesce((select max(task_number) from public.tasks), 0)
);

alter table public.tasks
  alter column task_number set default nextval('public.tasks_task_number_seq');

alter sequence public.tasks_task_number_seq owned by public.tasks.task_number;

alter table public.tasks alter column task_number set not null;

do $$
begin
  alter table public.tasks add constraint tasks_task_number_key unique (task_number);
exception
  when duplicate_object then null;
end $$;

-- Старая схема: title NOT NULL без task_text в INSERT — снимаем жёсткое ограничение
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'title'
  ) then
    execute 'alter table public.tasks alter column title drop not null';
  end if;
end $$;

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
