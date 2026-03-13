-- Migration incremental: feed global de acoes para admin

begin;

create table if not exists public.app_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  actor_role text,
  event_type text not null default 'info',
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_activity_logs_created_at on public.app_activity_logs(created_at desc);
create index if not exists idx_app_activity_logs_actor_id on public.app_activity_logs(actor_id);

alter table public.app_activity_logs enable row level security;

drop policy if exists app_activity_logs_select_admin on public.app_activity_logs;
create policy app_activity_logs_select_admin
on public.app_activity_logs
for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists app_activity_logs_insert_authenticated on public.app_activity_logs;
create policy app_activity_logs_insert_authenticated
on public.app_activity_logs
for insert
to authenticated
with check (
  auth.uid() is not null
  and (actor_id is null or actor_id = auth.uid())
);

drop trigger if exists trg_app_activity_logs_timestamps on public.app_activity_logs;
create trigger trg_app_activity_logs_timestamps
before insert or update on public.app_activity_logs
for each row execute function public.set_row_timestamps();

grant select, insert on table public.app_activity_logs to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_activity_logs'
  ) then
    execute 'alter publication supabase_realtime add table public.app_activity_logs';
  end if;
end $$;

commit;
