

begin;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin and p.is_active from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.user_has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_is_admin()
    or coalesce(
      (
        select pp.allowed
        from public.profile_permissions pp
        join public.profiles p on p.id = pp.profile_id
        where pp.profile_id = auth.uid()
          and pp.permission_key = p_permission_key
          and p.is_active
      ),
      false
    );
$$;

create or replace function public.user_has_obra_access(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when auth.uid() is null then false
      when public.current_user_is_admin() then true
      when p_obra_id is null then true
      else coalesce(
        (
          select
            p.is_active
            and (p.allowed_obra_id is null or p.allowed_obra_id = p_obra_id)
          from public.profiles p
          where p.id = auth.uid()
        ),
        false
      )
    end;
$$;

grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.user_has_permission(text) to authenticated;
grant execute on function public.user_has_obra_access(uuid) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'app_permissions',
    'profile_permissions',
    'obras',
    'equipamentos',
    'equipamento_readings',
    'equipamento_stoppages',
    'equipamento_issues',
    'maintenance_tasks',
    'colaboradores',
    'fuel_records',
    'diesel_deliveries',
    'bridge_projects',
    'bridge_materials',
    'bridge_material_withdrawals',
    'bridge_employees',
    'bridge_fixed_costs',
    'bridge_services',
    'bridge_daily_logs',
    'bridge_daily_log_equipments',
    'bridge_material_requests',
    'usina_aggregate_deliveries',
    'usina_bituminous_deliveries',
    'usina_daily_production',
    'usina_load_entries',
    'usina_tank_capacities',
    'app_activity_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;


-- Core policies


drop policy if exists profiles_select on public.profiles;
create policy profiles_select
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.current_user_is_admin());

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin
on public.profiles
for insert
to authenticated
with check (public.current_user_is_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
on public.profiles
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin
on public.profiles
for delete
to authenticated
using (public.current_user_is_admin());

drop policy if exists app_permissions_select on public.app_permissions;
create policy app_permissions_select
on public.app_permissions
for select
to authenticated
using (true);

drop policy if exists profile_permissions_select on public.profile_permissions;
create policy profile_permissions_select
on public.profile_permissions
for select
to authenticated
using (profile_id = auth.uid() or public.current_user_is_admin());

drop policy if exists profile_permissions_write_admin on public.profile_permissions;
create policy profile_permissions_write_admin
on public.profile_permissions
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

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

drop policy if exists obras_select on public.obras;
create policy obras_select
on public.obras
for select
to authenticated
using (public.user_has_obra_access(id));

drop policy if exists obras_write on public.obras;
create policy obras_write
on public.obras
for all
to authenticated
using (
  public.user_has_obra_access(id)
  and (public.current_user_is_admin() or public.user_has_permission('editBancoDados'))
)
with check (
  public.user_has_obra_access(id)
  and (public.current_user_is_admin() or public.user_has_permission('editBancoDados'))
);


-- Helper to apply standard policies on tables with obra_id


create or replace function public.apply_standard_rls(p_tables text[], p_write_expr text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
begin
  foreach t in array p_tables
  loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using (public.user_has_obra_access(obra_id));',
      t, t
    );

    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format(
      'create policy %I_write on public.%I for all to authenticated using (public.user_has_obra_access(obra_id) and (%s)) with check (public.user_has_obra_access(obra_id) and (%s));',
      t, t, p_write_expr, p_write_expr
    );
  end loop;
end;
$$;

-- Campo / Oficina
select public.apply_standard_rls(
  array[
    'equipamentos',
    'equipamento_readings',
    'equipamento_stoppages',
    'equipamento_issues',
    'maintenance_tasks'
  ],
  $$public.current_user_is_admin()
    or public.user_has_permission('editBancoDados')
    or public.user_has_permission('editCampo')
    or public.user_has_permission('editOficina')$$
);

-- Banco de dados base
select public.apply_standard_rls(
  array['colaboradores'],
  $$public.current_user_is_admin()
    or public.user_has_permission('editBancoDados')$$
);

-- Abastecimentos
select public.apply_standard_rls(
  array['fuel_records', 'diesel_deliveries'],
  $$public.current_user_is_admin()
    or public.user_has_permission('editBancoDados')
    or public.user_has_permission('editAbastecimentos')$$
);

-- Pontes
select public.apply_standard_rls(
  array[
    'bridge_projects',
    'bridge_materials',
    'bridge_material_withdrawals',
    'bridge_employees',
    'bridge_fixed_costs',
    'bridge_services',
    'bridge_daily_logs',
    'bridge_daily_log_equipments',
    'bridge_material_requests'
  ],
  $$public.current_user_is_admin()
    or public.user_has_permission('editBancoDados')
    or public.user_has_permission('viewPontes')$$
);

-- Usina
select public.apply_standard_rls(
  array[
    'usina_aggregate_deliveries',
    'usina_bituminous_deliveries',
    'usina_daily_production',
    'usina_load_entries',
    'usina_tank_capacities'
  ],
  $$public.current_user_is_admin()
    or public.user_has_permission('editBancoDados')
    or public.user_has_permission('viewUsina')$$
);

commit;
