-- ÓRBITA 2.0 — fundação do schema (Neon PostgreSQL).
--
-- Baseado nas migrations Supabase em supabase/migrations (preservadas como
-- referência histórica). Mudanças deliberadas, documentadas em
-- docs/orbita-2.0/phase-1/DATABASE.md:
--   * Chaves compostas (company_id, id) com o ID de domínio (PED-00001…):
--     uma FK composta torna IMPOSSÍVEL referenciar linha de outra empresa.
--   * Sem dependência de auth.users (Supabase): identidade vem do Neon Auth e
--     é ligada à empresa pela tabela memberships (autorização fica no app).
--   * RLS por empresa como defesa em profundidade (migration 0004).

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table companies (
  id text primary key,
  name text not null,
  region text,
  operation_type text not null default 'Rodoviária',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger companies_set_updated_at before update on companies
  for each row execute function set_updated_at();

-- Contadores sequenciais por empresa (origem de PED-00001, CAR-00001…).
-- Atualizados na mesma transação do comando, sob lock da empresa.
create table operation_counters (
  company_id text primary key references companies(id) on delete cascade,
  order_next integer not null default 1,
  load_next integer not null default 1,
  shipment_next integer not null default 1,
  delivery_next integer not null default 1,
  occurrence_next integer not null default 1,
  document_next integer not null default 1,
  pod_next integer not null default 1,
  event_next integer not null default 1,
  partner_next integer not null default 1,
  solicitation_next integer not null default 1,
  updated_at timestamptz not null default now()
);
create trigger operation_counters_set_updated_at before update on operation_counters
  for each row execute function set_updated_at();

-- Vínculo pessoa ↔ empresa ↔ papel. Chaveado por e-mail para permitir
-- convite antes do primeiro acesso; user_id (Neon Auth) é gravado no
-- primeiro login. Sem FK para o schema neon_auth de propósito: autenticação
-- e autorização ficam desacopladas.
create table memberships (
  company_id text not null references companies(id) on delete cascade,
  email text not null check (email = lower(email)),
  user_id text,
  role text not null check (role in ('administrador','gerente','planejador','operador','conferente','visualizacao','parceiro')),
  partner_company_id text,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, email),
  check (role <> 'parceiro' or partner_company_id is not null)
);
create index memberships_email_idx on memberships(email) where is_active;
create unique index memberships_user_company_idx on memberships(user_id, company_id) where user_id is not null;
create trigger memberships_set_updated_at before update on memberships
  for each row execute function set_updated_at();

-- Trilha de auditoria de comandos (quem fez o quê, quando, com qual resultado).
create table audit_log (
  id bigint generated always as identity primary key,
  company_id text not null references companies(id) on delete cascade,
  user_id text not null,
  email text not null,
  command_type text not null,
  payload jsonb not null,
  outcome text not null check (outcome in ('applied','rejected','denied','failed')),
  message text,
  created_at timestamptz not null default now()
);
create index audit_log_company_created_idx on audit_log(company_id, created_at desc);
