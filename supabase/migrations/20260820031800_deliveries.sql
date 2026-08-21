create table deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  display_id text not null,
  shipment_id uuid not null references shipments(id),
  order_id uuid not null references orders(id),
  customer_id uuid not null references customers(id),
  planned_window_start timestamptz not null,
  planned_window_end timestamptz not null,
  arrival_time timestamptz,
  completed_at timestamptz,
  result text check (result in ('Delivered','Partial Delivery','Failed','Returned')),
  pod_document_id uuid references documents(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index deliveries_company_display_id_idx on deliveries(company_id, display_id);
create index deliveries_shipment_idx on deliveries(shipment_id);
create index deliveries_order_idx on deliveries(order_id);

create trigger deliveries_set_updated_at
  before update on deliveries
  for each row execute function set_updated_at();
