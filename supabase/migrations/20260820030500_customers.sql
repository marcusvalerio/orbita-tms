create table customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  document text,
  location_id uuid references locations(id),
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_company_idx on customers(company_id);

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();
