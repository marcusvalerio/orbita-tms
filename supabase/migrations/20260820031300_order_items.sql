create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity numeric not null,
  weight_kg numeric not null,
  volume_m3 numeric,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on order_items(order_id);
