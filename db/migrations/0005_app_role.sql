-- Papel de execução da aplicação.
--
-- No Neon, o papel dono do banco tem BYPASSRLS: se a aplicação operasse com
-- ele, as políticas de 0004 seriam ignoradas. O repositório abre cada
-- transação de empresa com `SET LOCAL ROLE orbita_app`, um papel NOLOGIN e sem
-- BYPASSRLS — assim a RLS vale no caminho real de leitura e escrita, sem uma
-- credencial adicional para gerenciar.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'orbita_app') then
    create role orbita_app nologin nobypassrls;
  end if;
end $$;

grant orbita_app to current_user;
grant usage on schema public to orbita_app;
grant select, insert, update, delete on all tables in schema public to orbita_app;
grant usage, select on all sequences in schema public to orbita_app;
alter default privileges in schema public grant select, insert, update, delete on tables to orbita_app;
alter default privileges in schema public grant usage, select on sequences to orbita_app;
