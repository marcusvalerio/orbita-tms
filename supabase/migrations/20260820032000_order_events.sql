-- user_id nullable: null representa ação do sistema/automação (mesma
-- convenção já usada conceitualmente hoje no orderEvents em memória).
create table order_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  order_id uuid not null references orders(id),
  user_id uuid references profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  message text not null,
  previous_state jsonb,
  new_state jsonb,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on order_events(order_id);
create index order_events_company_idx on order_events(company_id, created_at desc);
