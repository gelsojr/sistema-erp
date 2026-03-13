
begin;

-- Equipamentos / Campo / Oficina

create table if not exists public.equipamentos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  prefix text not null,
  name text not null,
  brand text,
  model text,
  plate text,
  status text not null default 'Disponivel',
  hours numeric(12,2) not null default 0,
  next_maintenance date,
  situation text,
  responsavel text,
  paralisacao_motivo text,
  release_forecast_date date,
  status_change_date date,
  last_status_change_time text,
  last_status_change_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  unique (obra_id, prefix)
);

create table if not exists public.equipamento_readings (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  equipment_id uuid not null references public.equipamentos(id) on delete cascade,
  reading_at timestamptz not null default timezone('utc', now()),
  reading_date date generated always as ((reading_at at time zone 'utc')::date) stored,
  reading_value numeric(12,2) not null,
  status text,
  observation text,
  reported_by text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.equipamento_stoppages (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  equipment_id uuid not null references public.equipamentos(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz,
  reason text not null,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.equipamento_issues (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  equipment_id uuid not null references public.equipamentos(id) on delete cascade,
  status text not null default 'pending', -- pending | resolved
  description text not null,
  reported_by text,
  reported_at timestamptz not null default timezone('utc', now()),
  resolved_by text,
  resolved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  equipment_id uuid not null references public.equipamentos(id) on delete cascade,
  task text not null,
  due_date date,
  status text not null default 'pending', -- pending | done
  priority text not null default 'media', -- baixa | media | alta
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  name text not null,
  role text not null,
  machine_id uuid references public.equipamentos(id) on delete set null,
  phone text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);


-- Abastecimentos


create table if not exists public.fuel_records (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  machine_id uuid references public.equipamentos(id) on delete set null,
  record_date date not null default current_date,
  prefix text,
  machine_name text,
  h_km text,
  diesel numeric(12,3) not null default 0,
  arla numeric(12,3) not null default 0,
  grease text,
  details text,
  recorded_by text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.diesel_deliveries (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  delivery_date date not null default current_date,
  liters numeric(12,3) not null default 0,
  supplier text not null,
  ticket_number text,
  price_per_liter numeric(12,4),
  total_cost numeric(14,2),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);


-- Pontes


create table if not exists public.bridge_projects (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  name text not null,
  status text not null default 'Em Execucao',
  start_date date,
  last_check_in_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.bridge_materials (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  bridge_project_id uuid not null references public.bridge_projects(id) on delete cascade,
  receipt_date date not null default current_date,
  emission_date date,
  supplier text,
  doc_type text,
  doc_number text,
  material text not null,
  quantity numeric(14,3) not null default 0,
  unit text,
  unit_price numeric(14,4) not null default 0,
  freight_value numeric(14,2) not null default 0,
  tax_value numeric(14,2) not null default 0,
  total_value numeric(14,2) generated always as ((coalesce(quantity, 0) * coalesce(unit_price, 0)) + coalesce(freight_value, 0) + coalesce(tax_value, 0)) stored,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.bridge_material_withdrawals (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  bridge_project_id uuid not null references public.bridge_projects(id) on delete cascade,
  withdrawal_date date not null default current_date,
  material_name text not null,
  quantity numeric(14,3) not null default 0,
  purpose text,
  user_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.bridge_employees (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  bridge_project_id uuid not null references public.bridge_projects(id) on delete cascade,
  worker_id uuid references public.colaboradores(id) on delete set null,
  name text not null,
  role text not null,
  salary numeric(14,2) not null default 0,
  days_worked integer not null default 0,
  start_date date not null default current_date,
  status text not null default 'Trabalhando',
  de_baixada_since date,
  termination_date date,
  breakfast_cost numeric(14,2) default 0,
  lunch_cost numeric(14,2) default 0,
  dinner_cost numeric(14,2) default 0,
  travel_cost numeric(14,2) default 0,
  accommodation_cost numeric(14,2) default 0,
  total_additional_cost numeric(14,2) default 0,
  severance_pending boolean not null default false,
  severance_amount numeric(14,2) default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.bridge_fixed_costs (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  bridge_project_id uuid not null references public.bridge_projects(id) on delete cascade,
  description text not null,
  value numeric(14,2) not null default 0,
  cost_type text not null default 'Mensal', -- Mensal | Diario | Unico
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.bridge_services (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  bridge_project_id uuid not null references public.bridge_projects(id) on delete cascade,
  description text not null,
  due_date date,
  status text not null default 'Pendente',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.bridge_daily_logs (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  bridge_project_id uuid not null references public.bridge_projects(id) on delete cascade,
  log_date date not null default current_date,
  weather text not null default 'Sol',
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.bridge_daily_log_equipments (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  daily_log_id uuid not null references public.bridge_daily_logs(id) on delete cascade,
  equipment_id uuid references public.equipamentos(id) on delete set null,
  prefix text,
  daily_cost numeric(14,2) not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.bridge_material_requests (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  bridge_project_id uuid not null references public.bridge_projects(id) on delete cascade,
  request_date date not null default current_date,
  material text not null,
  quantity text not null,
  priority text not null default 'Media',
  status text not null default 'Pendente',
  requested_by text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);


-- Usina


create table if not exists public.usina_aggregate_deliveries (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  delivery_date date not null default current_date,
  product text not null, -- Brita 1 | Brita 0 | Po de Pedra | Pedra Pulmao
  tons numeric(14,3) not null default 0,
  ticket_number text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.usina_bituminous_deliveries (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  delivery_date date not null default current_date,
  product text not null, -- CAP | EAI | RR-2C | RR-1C
  tons numeric(14,3) not null default 0,
  ticket_number text,
  plate text,
  supplier text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.usina_daily_production (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  production_date date not null default current_date,
  gross_cbuq numeric(14,3) not null default 0,
  waste numeric(14,3) not null default 0,
  net_cbuq numeric(14,3) not null default 0,
  cap_consumed numeric(14,3) not null default 0,
  brita1_consumed numeric(14,3) not null default 0,
  brita0_consumed numeric(14,3) not null default 0,
  stone_dust_consumed numeric(14,3) not null default 0,
  initial_hour_meter numeric(14,2) not null default 0,
  final_hour_meter numeric(14,2) not null default 0,
  worked_hours numeric(14,2) not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.usina_load_entries (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  load_date date not null default current_date,
  plate text,
  tons numeric(14,3) not null default 0,
  temperature numeric(14,2),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.usina_tank_capacities (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  product text not null, -- CAP | EAI | RR-2C | RR-1C
  capacity_tons numeric(14,3) not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  client_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  unique (obra_id, product)
);

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


-- Indices


create index if not exists idx_equipamentos_obra on public.equipamentos(obra_id);
create index if not exists idx_readings_equipment on public.equipamento_readings(equipment_id, reading_at desc);
create index if not exists idx_stoppages_equipment on public.equipamento_stoppages(equipment_id, start_at desc);
create index if not exists idx_issues_equipment_status on public.equipamento_issues(equipment_id, status);
create index if not exists idx_maintenance_obra_due on public.maintenance_tasks(obra_id, due_date);
create index if not exists idx_colaboradores_obra on public.colaboradores(obra_id);
create index if not exists idx_fuel_obra_date on public.fuel_records(obra_id, record_date desc);
create index if not exists idx_diesel_obra_date on public.diesel_deliveries(obra_id, delivery_date desc);
create index if not exists idx_bridge_projects_obra on public.bridge_projects(obra_id);
create index if not exists idx_bridge_materials_project on public.bridge_materials(bridge_project_id, receipt_date desc);
create index if not exists idx_bridge_employees_project on public.bridge_employees(bridge_project_id);
create index if not exists idx_bridge_services_project on public.bridge_services(bridge_project_id, due_date);
create index if not exists idx_bridge_logs_project on public.bridge_daily_logs(bridge_project_id, log_date desc);
create index if not exists idx_usina_agg_obra_date on public.usina_aggregate_deliveries(obra_id, delivery_date desc);
create index if not exists idx_usina_bitu_obra_date on public.usina_bituminous_deliveries(obra_id, delivery_date desc);
create index if not exists idx_usina_prod_obra_date on public.usina_daily_production(obra_id, production_date desc);
create index if not exists idx_usina_load_obra_date on public.usina_load_entries(obra_id, load_date desc);
create index if not exists idx_app_activity_logs_created_at on public.app_activity_logs(created_at desc);
create index if not exists idx_app_activity_logs_actor_id on public.app_activity_logs(actor_id);


-- Timestamps triggers para todas as tabelas de dominio


do $$
declare
  t text;
begin
  foreach t in array array[
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
    execute format('drop trigger if exists trg_%I_timestamps on public.%I;', t, t);
    execute format(
      'create trigger trg_%I_timestamps before insert or update on public.%I for each row execute function public.set_row_timestamps();',
      t, t
    );
  end loop;
end $$;

commit;
