-- Migration incremental para projetos ja existentes
-- 1) Adiciona impostos em bridge_materials
-- 2) Corrige total_value para incluir impostos
-- 3) Adiciona data efetiva de "De Baixada" em bridge_employees

begin;

alter table if exists public.bridge_materials
  add column if not exists tax_value numeric(14,2) not null default 0;

-- Recria coluna gerada para incluir impostos no total
alter table if exists public.bridge_materials
  drop column if exists total_value;

alter table if exists public.bridge_materials
  add column total_value numeric(14,2)
  generated always as (
    (coalesce(quantity, 0) * coalesce(unit_price, 0))
    + coalesce(freight_value, 0)
    + coalesce(tax_value, 0)
  ) stored;

alter table if exists public.bridge_employees
  add column if not exists de_baixada_since date;

commit;
