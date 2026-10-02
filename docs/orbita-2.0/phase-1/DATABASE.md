# Fase 1 — Banco de dados (Neon PostgreSQL)

## Estado aplicado

| Item | Valor |
|---|---|
| Projeto Neon | `orbita-tms` (`winter-meadow-23402189`), região `aws-sa-east-1`, PostgreSQL 17 |
| Branch | `main` (`br-muddy-feather-b6x5vo24`), banco `orbita` |
| Migrations aplicadas | `0001`–`0005` (registradas em `schema_migrations` com checksum) |
| Empresa inicial | `atlas` — cadastros de referência (27 locais, 28 clientes, 8 produtos, 15 veículos, 15 motoristas, 5 transportadoras), **sem movimentação fictícia** |
| Acesso inicial | 1 administrador (e-mail do responsável pelo projeto) em `memberships` |
| Neon Auth | provisionado (Managed Better Auth) no mesmo branch |

As migrations foram aplicadas pelo conector Neon (a rede do ambiente de desenvolvimento bloqueia conexões diretas a `*.neon.tech`). Com acesso direto, `npm run db:migrate` reconhece o que já está aplicado pelo checksum.

## Relação com o schema Supabase

`supabase/migrations/` permanece como referência histórica. Toda a semântica foi preservada; mudanças deliberadas:

| Mudança | Motivo |
|---|---|
| PK composta `(company_id, id)` com o ID de domínio (`PED-00001`) no lugar de `uuid` + `display_id` | FK composta torna impossível referenciar dado de outra empresa; elimina tradução uuid ↔ código |
| `profiles → auth.users` substituído por `memberships` (por e-mail) | Neon não tem `auth.users`; autenticação (Neon Auth) e autorização (memberships) desacopladas |
| Status operacionais com `CHECK` | A preocupação original ("duas listas") foi resolvida por um teste que compara o SQL com as constantes do domínio |
| Novas tabelas: `shipment_stops`, `freights`, `tenders`, `partner_companies`, `solicitations`, `kpi_snapshots`, `operation_counters`, `audit_log` | Domínio v3 e Fase 1 não tinham onde persistir |
| Colunas novas em `orders` (janelas, B2B/B2C, carga, temperatura), `locations` (CEP, contato), `shipments` (rota, distância) | Ordem de Serviço completa já existia no domínio |
| FKs operacionais `DEFERRABLE INITIALLY DEFERRED` | Um comando grava entidades relacionadas na mesma transação |

## Isolamento por empresa

1. **FK composta** — referência cruzada entre empresas é rejeitada pelo banco.
2. **RLS forçada** (`0004`) em todas as tabelas operacionais: `company_id = current_setting('app.company_id')`.
3. **Papel `orbita_app`** (`0005`) — `NOLOGIN`, sem `BYPASSRLS`. No Neon, o dono do banco tem `BYPASSRLS`; por isso o repositório abre toda transação com `SET LOCAL ROLE orbita_app` + `set_config('app.company_id', …)`. Verificado no Neon: sem empresa no contexto, 0 linhas visíveis.
4. **Filtro no adapter** — toda consulta também filtra por `company_id`.

## Concorrência

`SELECT … FROM companies WHERE id = $1 FOR UPDATE` no início de cada comando serializa a escrita por empresa: contadores (`PED-00001…`) nunca duplicam. Coberto por teste com 6 comandos simultâneos.

## Comandos

```bash
npm run db:migrate                                   # aplica pendentes (DATABASE_URL_UNPOOLED ou DATABASE_URL)
npm run db:seed -- --company atlas                   # cadastros de referência (não sobrescreve empresa existente)
npm run db:seed -- --company atlas --with-demo       # inclui o cenário de demonstração (homologação)
npm run db:seed -- --company atlas --admin a@b.com   # concede administrador
npm run db:seed -- --company atlas --grant a@b.com:planejador
npm run db:seed -- --company atlas --grant p@parceiro.com:parceiro:PAR-00001
TEST_DATABASE_URL=postgres://…/orbita_test npm run test:integration
```

## Branches recomendados

`main` (produção) · `dev` (homologação, com `--with-demo`) · um branch efêmero por PR para testes de integração (plano Free: 512 MB por branch).
