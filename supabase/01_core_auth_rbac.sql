-- 01_core_auth_rbac.sql
-- Execute primeiro.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.obras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  status text not null default 'ativa',
  start_date date,
  end_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username citext not null,
  role text not null default 'Operador',
  is_admin boolean not null default false,
  is_active boolean not null default true,
  allowed_obra_id uuid references public.obras(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create unique index if not exists profiles_username_unique on public.profiles(username);

create table if not exists public.app_permissions (
  permission_key text primary key,
  label text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.app_permissions (permission_key, label, description) values
  ('editDashboard', 'Dashboard', 'Acesso ao dashboard'),
  ('editOficina', 'Oficina', 'Acesso ao modulo oficina'),
  ('editCampo', 'Em Campo', 'Acesso ao modulo em campo'),
  ('editAbastecimentos', 'Abastecimentos', 'Acesso ao modulo de abastecimentos'),
  ('editBancoDados', 'Banco de Dados', 'Acesso ao cadastro base'),
  ('editConfiguracoes', 'Configuracoes', 'Acesso a gestao de usuarios e permissoes'),
  ('viewRelatorios', 'Relatorios', 'Acesso aos relatorios'),
  ('viewPontes', 'Pontes', 'Acesso ao modulo de pontes'),
  ('viewUsina', 'Usina', 'Acesso ao modulo da usina')
on conflict (permission_key) do update
set label = excluded.label,
    description = excluded.description;

create table if not exists public.profile_permissions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null references public.app_permissions(permission_key) on delete cascade,
  allowed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, permission_key)
);

create or replace function public.set_row_timestamps()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_at is null then
      new.created_at := timezone('utc', now());
    end if;
    if new.client_updated_at is null then
      new.client_updated_at := timezone('utc', now());
    end if;
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_obras_timestamps on public.obras;
create trigger trg_obras_timestamps
before insert or update on public.obras
for each row execute function public.set_row_timestamps();

drop trigger if exists trg_profiles_timestamps on public.profiles;
create trigger trg_profiles_timestamps
before insert or update on public.profiles
for each row execute function public.set_row_timestamps();

drop trigger if exists trg_profile_permissions_timestamps on public.profile_permissions;
create trigger trg_profile_permissions_timestamps
before insert or update on public.profile_permissions
for each row execute function public.set_row_timestamps();

create or replace function public.enforce_max_profiles()
returns trigger
language plpgsql
as $$
declare
  v_active_count integer;
begin
  if new.is_active then
    select count(*)
      into v_active_count
      from public.profiles p
     where p.is_active
       and p.id <> new.id;

    if v_active_count >= 25 then
      raise exception 'Limite de 25 usuarios ativos atingido.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_max_15 on public.profiles;
create trigger trg_profiles_max_15
before insert or update of is_active
on public.profiles
for each row
execute function public.enforce_max_profiles();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_username text;
  v_full_name text;
  v_is_first_user boolean;
  v_active_count integer;
begin
  select count(*) into v_active_count from public.profiles where is_active;
  if v_active_count >= 25 then
    raise exception 'Limite de 25 usuarios ativos atingido.'
      using errcode = 'check_violation';
  end if;

  select count(*) = 0 into v_is_first_user from public.profiles;

  v_full_name := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  v_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'user_' || left(new.id::text, 8)
  );

  if exists (select 1 from public.profiles p where lower(p.username::text) = lower(v_username)) then
    v_username := v_username || '_' || left(new.id::text, 6);
  end if;

  insert into public.profiles (
    id,
    full_name,
    username,
    role,
    is_admin,
    is_active
  )
  values (
    new.id,
    v_full_name,
    v_username,
    case when v_is_first_user then 'Gerente Geral' else 'Operador' end,
    v_is_first_user,
    true
  )
  on conflict (id) do nothing;

  insert into public.profile_permissions (profile_id, permission_key, allowed)
  select
    new.id,
    ap.permission_key,
    v_is_first_user
  from public.app_permissions ap
  on conflict (profile_id, permission_key) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

insert into public.profile_permissions (profile_id, permission_key, allowed)
select p.id, ap.permission_key, p.is_admin
from public.profiles p
cross join public.app_permissions ap
on conflict (profile_id, permission_key) do nothing;

commit;
