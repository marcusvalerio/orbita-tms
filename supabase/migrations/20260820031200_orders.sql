-- status permanece text livre (sem check constraint fechado) de propósito:
-- a união de valores válidos já é modelada como OrderStatus no domínio
-- TypeScript (lib/domain/types.ts). Duplicar essa lista como constraint em
-- dois lugares (SQL e TS) criaria dois pontos para manter sincronizados
-- sempre que o domínio evoluir.
create table orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  display_id text not null,
  customer_id uuid not null references customers(id),
  origin_id uuid not null references locations(id),
  destination_id uuid not null references locations(id),
  total_weight_kg numeric not null,
  total_volume_m3 numeric not null,
  due_date date not null,
  priority text not null check (priority in ('Normal','Alta','Urgente')),
  status text not null,
  load_id uuid references loads(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index orders_company_display_id_idx on orders(company_id, display_id);
create index orders_company_status_idx on orders(company_id, status);
create index orders_customer_idx on orders(customer_id);

create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();
