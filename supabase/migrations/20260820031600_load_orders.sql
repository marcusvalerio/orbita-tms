create table load_orders (
  load_id uuid not null references loads(id) on delete cascade,
  order_id uuid not null references orders(id),
  primary key (load_id, order_id)
);

create index load_orders_order_idx on load_orders(order_id);
