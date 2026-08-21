-- shipment_id referencia shipments(id), mas shipments também referencia
-- loads(id) (shipments.load_id) — dependência circular entre as duas
-- tabelas. A coluna nasce aqui sem a foreign key; a constraint é
-- adicionada na migration 20260820031500_loads_shipment_fk depois que
-- shipments existir.
create table loads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  display_id text not null,
  origin_id uuid not null references locations(id),
  destination_id uuid not null references locations(id),
  total_weight_kg numeric not null,
  total_volume_m3 numeric not null,
  status text not null,
  shipment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index loads_company_display_id_idx on loads(company_id, display_id);
create index loads_company_status_idx on loads(company_id, status);

create trigger loads_set_updated_at
  before update on loads
  for each row execute function set_updated_at();
