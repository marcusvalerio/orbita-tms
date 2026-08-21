create table shipments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  display_id text not null,
  load_id uuid not null references loads(id),
  carrier_id uuid not null references carriers(id),
  vehicle_id uuid not null references vehicles(id),
  driver_id uuid not null references drivers(id),
  origin_id uuid not null references locations(id),
  destination_id uuid not null references locations(id),
  departure_time timestamptz not null,
  eta_time timestamptz not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index shipments_company_display_id_idx on shipments(company_id, display_id);
create index shipments_company_status_idx on shipments(company_id, status);
create index shipments_load_idx on shipments(load_id);
create index shipments_vehicle_idx on shipments(vehicle_id);
create index shipments_driver_idx on shipments(driver_id);

create trigger shipments_set_updated_at
  before update on shipments
  for each row execute function set_updated_at();
