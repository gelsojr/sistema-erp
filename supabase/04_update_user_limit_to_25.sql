-- 04_update_user_limit_to_25.sql
-- Execute este script em projetos que ja estavam com limite 15.

begin;

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

commit;
