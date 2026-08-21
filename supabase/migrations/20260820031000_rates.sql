create table rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  carrier_id uuid not null references carriers(id),
  origin_state text not null,
  destination_state text not null,
  brackets jsonb not null, -- [{min_kg, max_kg, min_value, value_per_kg}]
  value_per_km numeric,
  toll numeric not null default 0,
  gris_percent numeric not null default 0,
  ad_valorem_percent numeric not null default 0,
  additional_fees numeric not null default 0,
  valid_from date not null default current_date,
  valid_until date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rates_company_carrier_route_idx on rates(company_id, carrier_id, origin_state, destination_state);

create trigger rates_set_updated_at
  before update on rates
  for each row execute function set_updated_at();
