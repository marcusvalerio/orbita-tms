-- Cadastros (dados de referência) por empresa.
-- `seq` preserva a ordem de inserção para leitura estável.

create table locations (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  name text not null,
  city text not null,
  state text not null,
  country text not null default 'BR',
  kind text not null check (kind in ('CD','Cliente','Parceiro')),
  lat numeric(9,6) not null check (lat between -90 and 90),
  lng numeric(9,6) not null check (lng between -180 and 180),
  address text,
  cep text,
  complement text,
  reference text,
  contact_name text,
  contact_phone text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);
create trigger locations_set_updated_at before update on locations for each row execute function set_updated_at();

create table customers (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  name text not null,
  document text,
  location_id text not null,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id),
  foreign key (company_id, location_id) references locations(company_id, id) deferrable initially deferred
);
create trigger customers_set_updated_at before update on customers for each row execute function set_updated_at();

create table products (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  sku text,
  name text not null,
  category text not null,
  weight_kg numeric,
  volume_m3 numeric,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);
create trigger products_set_updated_at before update on products for each row execute function set_updated_at();

create table vehicles (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  plate text not null,
  type text not null check (type in ('Van','Toco','Truck','Carreta')),
  capacity_kg numeric not null check (capacity_kg > 0),
  capacity_m3 numeric not null check (capacity_m3 > 0),
  ownership text not null check (ownership in ('Frota Própria','Terceiro')),
  status text not null default 'Disponível' check (status in ('Disponível','Em Viagem','Manutenção','Inativo')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);
create unique index vehicles_company_plate_idx on vehicles(company_id, plate) where deleted_at is null;
create index vehicles_company_status_idx on vehicles(company_id, status);
create trigger vehicles_set_updated_at before update on vehicles for each row execute function set_updated_at();

create table drivers (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  name text not null,
  document text,
  cnh_category text not null,
  status text not null default 'Disponível' check (status in ('Disponível','Em Viagem','Folga','Inativo')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);
create index drivers_company_status_idx on drivers(company_id, status);
create trigger drivers_set_updated_at before update on drivers for each row execute function set_updated_at();

create table carriers (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  name text not null,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  regions text[] not null default '{}',
  cargo_types text[] not null default '{}',
  sla_percent numeric not null check (sla_percent between 0 and 100),
  otif_percent numeric not null check (otif_percent between 0 and 100),
  avg_cost_per_km numeric not null,
  occurrence_rate numeric not null default 0 check (occurrence_rate between 0 and 1),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);
create trigger carriers_set_updated_at before update on carriers for each row execute function set_updated_at();

create table rates (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  carrier_id text not null,
  origin_state text not null,
  destination_state text not null,
  brackets jsonb not null, -- [{minKg, maxKg, price}]
  toll numeric not null default 0,
  gris numeric not null default 0,
  ad_valorem numeric not null default 0,
  pickup_fee numeric not null default 0,
  delivery_fee numeric not null default 0,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id),
  foreign key (company_id, carrier_id) references carriers(company_id, id) deferrable initially deferred
);
create index rates_route_idx on rates(company_id, carrier_id, origin_state, destination_state);
create trigger rates_set_updated_at before update on rates for each row execute function set_updated_at();

create table partner_companies (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  legal_name text not null,
  trade_name text,
  cnpj text,
  responsible_name text,
  phone text,
  email text,
  cep text,
  address text,
  address_number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  notes text,
  status text not null check (status in ('Ativa','Inativa')),
  access_code text not null,
  registered_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id)
);
create unique index partner_companies_access_code_idx on partner_companies(company_id, access_code);
create trigger partner_companies_set_updated_at before update on partner_companies for each row execute function set_updated_at();

alter table memberships
  add foreign key (company_id, partner_company_id) references partner_companies(company_id, id);
