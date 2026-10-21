-- Movimentação operacional: pedido → carga → viagem (paradas) → ocorrência → entrega.
-- As listas de status espelham as constantes de lib/domain/types.ts; um teste
-- (db/schema.test.ts) falha se as duas fontes divergirem.
-- FKs entre tabelas operacionais são DEFERRABLE: um comando grava várias
-- entidades relacionadas na mesma transação, em qualquer ordem.

create table orders (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  customer_id text not null,
  origin_id text not null,
  destination_id text not null,
  total_weight_kg numeric not null check (total_weight_kg > 0),
  total_volume_m3 numeric not null check (total_volume_m3 >= 0),
  due_date date not null,
  priority text not null check (priority in ('Normal','Alta','Urgente')),
  status text not null check (status in ('Aguardando planejamento','Planejado','Em transporte','Entregue','Com ocorrência','Devolvido')),
  load_id text,
  operation_type text not null check (operation_type in ('B2B','B2C','Outro')),
  requested_by text,
  request_date timestamptz not null,
  general_notes text,
  pickup_date date not null,
  pickup_window_start text check (pickup_window_start ~ '^\d{2}:\d{2}$'),
  pickup_window_end text check (pickup_window_end ~ '^\d{2}:\d{2}$'),
  delivery_window_start text check (delivery_window_start ~ '^\d{2}:\d{2}$'),
  delivery_window_end text check (delivery_window_end ~ '^\d{2}:\d{2}$'),
  destination_contact_name text,
  destination_contact_phone text,
  cargo_characteristics text[] not null default '{}' check (cargo_characteristics <@ array['Refrigerada','Congelada','Temperatura ambiente','Frágil','Alto valor','Perigosa','Perecível','Sensível à umidade','Manuseio especial']::text[]),
  temperature_min numeric,
  temperature_max numeric,
  temperature_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id),
  check (due_date >= pickup_date),
  foreign key (company_id, customer_id) references customers(company_id, id) deferrable initially deferred,
  foreign key (company_id, origin_id) references locations(company_id, id) deferrable initially deferred,
  foreign key (company_id, destination_id) references locations(company_id, id) deferrable initially deferred
);
create index orders_company_status_idx on orders(company_id, status);
create index orders_customer_idx on orders(company_id, customer_id);
create trigger orders_set_updated_at before update on orders for each row execute function set_updated_at();

create table order_items (
  company_id text not null,
  order_id text not null,
  id text not null,
  position integer not null,
  product_id text,
  description text,
  quantity numeric not null check (quantity > 0),
  unit_weight_kg numeric not null check (unit_weight_kg > 0),
  weight_kg numeric not null,
  volume_m3 numeric check (volume_m3 >= 0),
  primary key (company_id, id),
  check (product_id is not null or description is not null),
  foreign key (company_id, order_id) references orders(company_id, id) on delete cascade deferrable initially deferred,
  foreign key (company_id, product_id) references products(company_id, id) deferrable initially deferred
);
create index order_items_order_idx on order_items(company_id, order_id);

create table loads (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  origin_id text not null,
  destination_id text not null,
  total_weight_kg numeric not null,
  total_volume_m3 numeric not null,
  status text not null check (status in ('Em consolidação','Aguardando transporte','Contratada','Em viagem','Concluída')),
  shipment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id),
  foreign key (company_id, origin_id) references locations(company_id, id) deferrable initially deferred,
  foreign key (company_id, destination_id) references locations(company_id, id) deferrable initially deferred
);
create index loads_company_status_idx on loads(company_id, status);
create trigger loads_set_updated_at before update on loads for each row execute function set_updated_at();

alter table orders add foreign key (company_id, load_id) references loads(company_id, id) deferrable initially deferred;

create table load_orders (
  company_id text not null,
  load_id text not null,
  order_id text not null,
  position integer not null,
  primary key (company_id, load_id, order_id),
  foreign key (company_id, load_id) references loads(company_id, id) on delete cascade deferrable initially deferred,
  foreign key (company_id, order_id) references orders(company_id, id) deferrable initially deferred
);
create index load_orders_order_idx on load_orders(company_id, order_id);

create table tenders (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  load_id text not null,
  options jsonb not null, -- snapshot das opções cotadas no momento da contratação
  selected_option_id text,
  created_at timestamptz not null default now(),
  primary key (company_id, id),
  foreign key (company_id, load_id) references loads(company_id, id) deferrable initially deferred
);

create table shipments (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  route_code text,
  load_id text not null,
  carrier_id text, -- nulo = frota própria
  vehicle_id text, -- nulo = veículo fornecido pela transportadora
  driver_id text,
  origin_id text not null,
  destination_id text not null,
  departure_time timestamptz not null,
  eta_time timestamptz not null,
  status text not null check (status in ('Planned','Awaiting Pickup','Pickup Completed','In Transit','At Delivery','Delivered','Closed','Exception')),
  planned_distance_km numeric,
  planned_duration_min integer,
  delivery_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id),
  check (carrier_id is not null or (vehicle_id is not null and driver_id is not null)),
  foreign key (company_id, load_id) references loads(company_id, id) deferrable initially deferred,
  foreign key (company_id, carrier_id) references carriers(company_id, id) deferrable initially deferred,
  foreign key (company_id, vehicle_id) references vehicles(company_id, id) deferrable initially deferred,
  foreign key (company_id, driver_id) references drivers(company_id, id) deferrable initially deferred,
  foreign key (company_id, origin_id) references locations(company_id, id) deferrable initially deferred,
  foreign key (company_id, destination_id) references locations(company_id, id) deferrable initially deferred
);
create index shipments_company_status_idx on shipments(company_id, status);
create index shipments_vehicle_idx on shipments(company_id, vehicle_id);
create index shipments_driver_idx on shipments(company_id, driver_id);
create trigger shipments_set_updated_at before update on shipments for each row execute function set_updated_at();

alter table loads add foreign key (company_id, shipment_id) references shipments(company_id, id) deferrable initially deferred;

-- Paradas da viagem (rota multi-parada).
create table shipment_stops (
  company_id text not null,
  shipment_id text not null,
  id text not null,
  location_id text not null,
  sequence integer not null check (sequence >= 1),
  kind text not null check (kind in ('Coleta','Entrega')),
  planned_time timestamptz not null,
  actual_time timestamptz,
  order_ids text[],
  window_start timestamptz,
  window_end timestamptz,
  service_minutes integer,
  primary key (company_id, id),
  unique (company_id, shipment_id, sequence),
  check (window_start is null or window_end is null or window_start <= window_end),
  foreign key (company_id, shipment_id) references shipments(company_id, id) on delete cascade deferrable initially deferred,
  foreign key (company_id, location_id) references locations(company_id, id) deferrable initially deferred
);

create table freights (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  shipment_id text not null,
  rate_id text,
  label text,
  base_cost numeric not null,
  toll numeric not null,
  gris numeric not null,
  ad_valorem numeric not null,
  additional_fees numeric not null,
  total_cost numeric not null check (total_cost >= 0),
  created_at timestamptz not null default now(),
  primary key (company_id, id),
  foreign key (company_id, shipment_id) references shipments(company_id, id) deferrable initially deferred,
  foreign key (company_id, rate_id) references rates(company_id, id) deferrable initially deferred
);
create index freights_shipment_idx on freights(company_id, shipment_id);

create table occurrences (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  shipment_id text not null,
  type text not null check (type in ('Atraso','Avaria','Destinatário ausente','Endereço incorreto','Problema mecânico','Acidente','Extravio','Roubo','Recusa','Devolução')),
  description text not null,
  severity text not null check (severity in ('Baixa','Média','Crítica')),
  reported_at timestamptz not null,
  resolved boolean not null default false,
  resolved_at timestamptz,
  action text check (action in ('Reagendar','Nova tentativa','Devolver','Contatar cliente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id),
  check (not resolved or action is not null),
  foreign key (company_id, shipment_id) references shipments(company_id, id) deferrable initially deferred
);
create index occurrences_open_idx on occurrences(company_id, shipment_id) where not resolved;
create trigger occurrences_set_updated_at before update on occurrences for each row execute function set_updated_at();

create table documents (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  type text not null check (type in ('Ordem de Transporte','Romaneio','NF-e','CT-e','MDF-e','POD')),
  shipment_id text not null,
  -- simulated tem default true de propósito: um documento só deixa de ser
  -- simulado por ação explícita futura, nunca por omissão.
  simulated boolean not null default true,
  document_number text,
  file_url text,
  issued_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (company_id, id),
  foreign key (company_id, shipment_id) references shipments(company_id, id) deferrable initially deferred
);

create table deliveries (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  shipment_id text not null,
  order_id text not null,
  customer_id text not null,
  planned_window_start timestamptz not null,
  planned_window_end timestamptz not null,
  arrival_time timestamptz,
  completed_at timestamptz,
  result text check (result in ('Delivered','Partial Delivery','Failed','Returned')),
  pod_document_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id),
  check (planned_window_start <= planned_window_end),
  foreign key (company_id, shipment_id) references shipments(company_id, id) deferrable initially deferred,
  foreign key (company_id, order_id) references orders(company_id, id) deferrable initially deferred,
  foreign key (company_id, customer_id) references customers(company_id, id) deferrable initially deferred,
  foreign key (company_id, pod_document_id) references documents(company_id, id) deferrable initially deferred
);
create index deliveries_shipment_idx on deliveries(company_id, shipment_id);
create index deliveries_order_idx on deliveries(company_id, order_id);
create trigger deliveries_set_updated_at before update on deliveries for each row execute function set_updated_at();

create table order_events (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  order_id text not null,
  message text not null,
  occurred_at timestamptz not null,
  primary key (company_id, id),
  foreign key (company_id, order_id) references orders(company_id, id) deferrable initially deferred
);
create index order_events_order_idx on order_events(company_id, order_id);

create table solicitations (
  company_id text not null references companies(id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  partner_company_id text not null,
  requested_by text,
  contact text,
  operation_type text not null check (operation_type in ('B2B','B2C')),
  origin_id text not null,
  destination_id text not null,
  pickup_date date not null,
  pickup_window_start text,
  pickup_window_end text,
  delivery_date date not null,
  delivery_window_start text,
  delivery_window_end text,
  destination_contact_name text,
  destination_contact_phone text,
  product_description text not null,
  quantity numeric not null check (quantity > 0),
  total_weight_kg numeric not null check (total_weight_kg > 0),
  total_volume_m3 numeric,
  unit text,
  cargo_characteristics text[] not null default '{}',
  temperature_min numeric,
  temperature_max numeric,
  temperature_notes text,
  nfe_number text,
  romaneio_number text,
  other_documents text,
  notes text,
  status text not null check (status in ('Solicitada','Em análise','Convertida em Pedido','Recusada')),
  order_id text,
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, id),
  foreign key (company_id, partner_company_id) references partner_companies(company_id, id) deferrable initially deferred,
  foreign key (company_id, origin_id) references locations(company_id, id) deferrable initially deferred,
  foreign key (company_id, destination_id) references locations(company_id, id) deferrable initially deferred,
  foreign key (company_id, order_id) references orders(company_id, id) deferrable initially deferred
);
create index solicitations_partner_idx on solicitations(company_id, partner_company_id);
create trigger solicitations_set_updated_at before update on solicitations for each row execute function set_updated_at();

create table kpi_snapshots (
  company_id text not null references companies(id) on delete cascade,
  date date not null,
  otif_percent numeric not null,
  otd_percent numeric not null,
  occupancy_percent numeric not null,
  cost_per_delivery numeric not null,
  cost_per_km numeric not null,
  primary key (company_id, date)
);
