create table drivers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  document text,
  cnh_category text not null,
  status text not null default 'Disponível' check (status in ('Disponível','Em Viagem','Folga','Inativo')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index drivers_company_status_idx on drivers(company_id, status);

create trigger drivers_set_updated_at
  before update on drivers
  for each row execute function set_updated_at();
