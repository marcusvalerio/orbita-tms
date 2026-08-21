create table occurrences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  display_id text not null,
  shipment_id uuid not null references shipments(id),
  type text not null,
  description text,
  severity text not null check (severity in ('Baixa','Média','Crítica')),
  reported_at timestamptz not null default now(),
  resolved boolean not null default false,
  action text,
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index occurrences_company_display_id_idx on occurrences(company_id, display_id);
create index occurrences_company_resolved_idx on occurrences(company_id, resolved);
create index occurrences_shipment_idx on occurrences(shipment_id);

create trigger occurrences_set_updated_at
  before update on occurrences
  for each row execute function set_updated_at();
