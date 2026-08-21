-- simulated tem default true de propósito: um documento só deixa de ser
-- simulado por ação explícita futura, nunca por omissão.
create table documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  display_id text not null,
  type text not null check (type in ('Ordem de Transporte','Romaneio','NF-e','CT-e','MDF-e','POD')),
  shipment_id uuid not null references shipments(id),
  simulated boolean not null default true,
  document_number text,
  issued_at timestamptz not null default now(),
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index documents_company_display_id_idx on documents(company_id, display_id);
create index documents_shipment_idx on documents(shipment_id);

create trigger documents_set_updated_at
  before update on documents
  for each row execute function set_updated_at();
