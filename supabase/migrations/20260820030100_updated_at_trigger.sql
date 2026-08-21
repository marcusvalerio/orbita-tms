-- Função utilitária aplicada via trigger BEFORE UPDATE em toda tabela que
-- possui updated_at, para não repetir a lógica em cada uma.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
