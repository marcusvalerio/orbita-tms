create table locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  city text not null,
  state text not null,
  country text not null default 'BR',
  kind text not null check (kind in ('CD','Cliente','Parceiro')),
  address text,
  latitude numeric,
  longitude numeric,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locations_company_idx on locations(company_id);

create trigger locations_set_updated_at
  before update on locations
  for each row execute function set_updated_at();
