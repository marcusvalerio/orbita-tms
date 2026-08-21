create table carriers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  regions text[],
  cargo_types text[],
  sla_percent numeric not null check (sla_percent between 0 and 100),
  otif_percent numeric not null check (otif_percent between 0 and 100),
  avg_cost_per_km numeric not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index carriers_company_idx on carriers(company_id);

create trigger carriers_set_updated_at
  before update on carriers
  for each row execute function set_updated_at();
