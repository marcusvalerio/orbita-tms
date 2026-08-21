create table products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  sku text,
  name text not null,
  category text,
  weight_kg numeric,
  volume_m3 numeric,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_company_idx on products(company_id);

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();
