create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id),
  name text not null,
  email text not null,
  role text not null check (role in ('administrador','gerente','planejador','operador','conferente','visualizacao')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_company_email_idx on profiles(company_id, email);
create index profiles_company_idx on profiles(company_id);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();
