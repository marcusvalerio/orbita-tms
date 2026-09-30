-- Isolamento por empresa no próprio banco (defesa em profundidade).
-- O repositório abre cada transação com:
--   select set_config('app.company_id', '<empresa>', true)
-- Sem essa configuração, nenhuma linha operacional é visível ou gravável.
-- FORCE aplica a política também ao dono das tabelas. Diretório de tenancy
-- (companies, memberships) e audit_log ficam fora: são acessados apenas pelo
-- servidor antes de a empresa da sessão ser conhecida.

do $$
declare
  t text;
begin
  foreach t in array array[
    'operation_counters','locations','customers','products','vehicles','drivers','carriers','rates',
    'partner_companies','orders','order_items','loads','load_orders','tenders','shipments',
    'shipment_stops','freights','occurrences','documents','deliveries','order_events',
    'solicitations','kpi_snapshots'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I using (company_id = current_setting(''app.company_id'', true)) with check (company_id = current_setting(''app.company_id'', true))',
      t
    );
  end loop;
end $$;
