create table vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  plate text not null,
  type text not null check (type in ('Van','Toco','Truck','Carreta')),
  capacity_kg numeric not null,
  capacity_m3 numeric not null,
  ownership text not null check (ownership in ('Frota Própria','Terceiro')),
  status text not null default 'Disponível' check (status in ('Disponível','Em Viagem','Manutenção','Inativo')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index vehicles_company_plate_idx on vehicles(company_id, plate) where deleted_at is null;
create index vehicles_company_status_idx on vehicles(company_id, status);

create trigger vehicles_set_updated_at
  before update on vehicles
  for each row execute function set_updated_at();
