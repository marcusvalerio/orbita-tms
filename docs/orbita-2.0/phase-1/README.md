# ÓRBITA 2.0 — Fase 1: Arquitetura, Neon, Auth, RBAC e Google Maps

> Concluída em 30/09/2026 · branch `claude/amazing-dijkstra-snacv5`

## Objetivo

Sair de um simulador 100% no navegador para uma base de produto real — persistência no Neon, identidade, autorização por papel — **sem perder o Modo Demo**, e preparar o ÓRBITA para mapas e rastreamento reais com Google Maps atrás de uma camada de provedores.

## Entregas

| Entrega | Onde | Detalhes |
|---|---|---|
| Correção das regras de negócio L1–L12 da auditoria | `lib/sim/reducer.ts`, `lib/data/atlas.ts`, `lib/sim/generate-atlas.ts` | [ARCHITECTURE](ARCHITECTURE.md) |
| Rotas multi-parada (sequência sugerida, janelas por parada, distância/duração planejadas) | `lib/domain/geo.ts`, reducer | — |
| Camada de aplicação e portas | `lib/application` | [ARCHITECTURE](ARCHITECTURE.md) |
| Modo Demo × Modo Produção | `components/operation/OperationProvider.tsx`, `lib/server/*` | [ARCHITECTURE](ARCHITECTURE.md) |
| Neon PostgreSQL (schema, RLS, papel `orbita_app`, migrations, seed) — **aplicado no projeto `orbita-tms`** | `db/`, `lib/infrastructure/postgres` | [DATABASE](DATABASE.md) |
| Neon Auth — **provisionado** — e RBAC com 7 papéis | `lib/auth`, `lib/authz`, `proxy.ts`, `app/auth` | [AUTH-RBAC](AUTH-RBAC.md) |
| Trilha de auditoria de comandos | `audit_log` | [DATABASE](DATABASE.md) |
| Google Maps (mapa, Routes, Geocoding) com fallback | `lib/geo`, `app/api/geo`, `app/(ops)/mapa` | [GOOGLE-MAPS](GOOGLE-MAPS.md) |
| Motor de simulação + `DemoTrackingProvider` (PLAY/PAUSE/RESET, 0,5×–10×) | `lib/geo/simulation` | [GOOGLE-MAPS](GOOGLE-MAPS.md) |
| CI, E2E, `.env.example`, guia de implantação | `.github/workflows/ci.yml`, `tests/e2e`, [SETUP](SETUP.md) | — |

## Validação

| Verificação | Resultado |
|---|---|
| `npm run lint` | 0 erros, 0 avisos (antes: 2 erros, 3 avisos) |
| `npm run typecheck` | limpo |
| `npm test` (unitários) | **69/69** (antes: 11) |
| `npm run test:integration` (PostgreSQL 16 real) | **8/8** — round-trip completo, RLS, FK composta, concorrência, auditoria |
| `npm run test:e2e` (Playwright) | **15/15** — fluxo Demo ponta a ponta, mapa e simulação, Produção com papéis, parceiro isolado, APIs com 401 |
| `npm run build` | OK, 20 rotas (incluindo `/mapa`, `/auth/sign-in`, `/acesso-pendente` e `/api/geo/*`) |
| Neon | 5 migrations, 27 tabelas, 23 políticas RLS; `orbita_app` sem `BYPASSRLS` vê 0 linhas sem empresa no contexto |
| Google Routes API | rota real calculada (81,7 km / 2 h 09 na RJ-ZONA-OESTE-042) |
| Chave do Google | 0 ocorrências no bundle e no Git |

## Achados durante a fase

- **O dono do banco no Neon tem `BYPASSRLS`** — sem o papel `orbita_app`, as políticas RLS não teriam efeito em produção. Corrigido na migration `0005`.
- **Item de pedido sem produto nem descrição** era aceito pelo domínio; o `CHECK` do banco revelou. Regra levada ao domínio.
- **Contratação nunca navegava para a viagem criada** (closure com dados antigos em `setTimeout`). Corrigido.
- **Planejamento dependia de uma cadeia de `useEffect`** para criar carga → viagem → navegar; virou sequência explícita aguardando o resultado de cada comando.

## Limitações e pendências (honestas)

| Item | Situação |
|---|---|
| Neon Auth de ponta a ponta | Implementado conforme o SDK oficial, **não exercitado ao vivo**: a rede do ambiente de desenvolvimento bloqueia `*.neon.tech`. Produção foi validada com o provedor local na mesma porta; validar login real na Vercel (checklist em SETUP). |
| Mapa do Google no navegador | Não validado visualmente aqui (proxy de rede + projeto Google sem faturamento). Routes API validada; fallback esquemático validado. |
| Geocoding API | Chave atual retorna `REQUEST_DENIED` (faturamento). Busca cai para o cadastro local. |
| Rastreamento real | Fora do escopo; caminho documentado (Fleet Engine / Last Mile Fleet Solution). |
| Navegação mobile e Design System | Fases 2–4 (auditoria). |

## Próxima fase

Fase 2 — Design System 2.0 (tokens, componentes acessíveis, contraste AA), conforme o roadmap da auditoria.
