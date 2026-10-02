# ÓRBITA 2.0 — AUDIT REPORT

> Fase 0 — Auditoria. Nenhum código de produto foi alterado nesta fase.
> Data: 30/09/2026 · Base auditada: `91a6e5e` (branch `claude/amazing-dijkstra-snacv5`)

## Sumário executivo

O ÓRBITA hoje é um **simulador operacional 100% client-side** muito bem intencionado, não um TMS com backend. Todo o estado vive num único `React Context` + `reducer` persistido em `localStorage` (`orbita-tms-simulation-v1`, schema v3). Existe um schema PostgreSQL (21 migrations Supabase, 18 tabelas), mas **ele nunca foi conectado**: não há cliente de banco, ORM, variável de ambiente, API route ou server action no repositório. O projeto Supabase `orbita-tms` (sa-east-1) está **pausado** e não existe projeto Neon para o ÓRBITA.

Consequência direta para o plano: **"migrar o banco para Neon" não é uma migração de dados, é a criação da camada de persistência** — o maior item estrutural da transformação. Pela regra 25 ("problema estrutural importante: pare e informe"), essa é a primeira decisão a validar antes da Fase 1 (ver [Decisões pendentes](#decisões-pendentes)).

O que existe de valor e deve ser preservado: um **modelo de domínio coerente** (Pedido → Carga → Contratação → Viagem → Ocorrência → Entrega → POD), um **reducer puro** com validações de domínio, **persistência versionada com migrações e 11 testes**, um **motor de planejamento** com 3 alternativas explicáveis, **cotação de frete com composição** (frete-peso, Ad Valorem, GRIS, pedágio, TDE), e o fluxo **Portal do Parceiro → Solicitação → Pedido**.

O que falta para ser um TMS: rotas multi-parada, mapa, rastreamento, frota/motoristas como módulos, exceções como entidade de primeira classe, persistência real, autenticação, multiempresa, e um Design System de verdade.

Linha de base medida:

| Verificação | Resultado |
|---|---|
| `npm test` (node:test) | **11/11** passam (só persistência) |
| `tsc --noEmit` | limpo |
| `eslint` | **2 erros**, 3 avisos → `npm run lint` falha |
| `next build` | OK, 14 rotas (13 estáticas + `/shipments/[id]`) |
| E2E | inexistente |
| CI/CD | inexistente (sem `.github/`) |
| Linhas de código | ~6.900 (TS/TSX/SQL/CSS) |

---

## 1. Current Architecture

### 1.1 Stack

| Item | Estado | Classificação |
|---|---|---|
| Framework | Next.js **16.3.1** (App Router, Turbopack) | KEEP |
| React | **19.2.8** + React Compiler lint rules | KEEP |
| TypeScript | 5.x, `strict: true`, alias `@/*` | KEEP |
| Estilo | Tailwind CSS v4 (`@theme inline`), 6 tokens de cor | REPLACE (por DS 2.0) |
| Fontes | Sora (display) + Inter como stand-in de Roobert (licenciada, ausente) | IMPROVE |
| Dependências de runtime | apenas `next`, `react`, `react-dom` | KEEP (princípio de enxutez) |
| Ícones | SVG inline ad hoc (2 ícones) | MISSING |
| Primitivos acessíveis (dialog/menu/combobox) | nenhum | MISSING |
| Motion | só `transition-colors` / `rotate` pontuais | MISSING |
| Mapa | nenhum (lat/lng existem no domínio, nunca renderizados) | MISSING |

### 1.2 Camadas

```
app/**/page.tsx  ("use client" em todas)
      │  useSimulation()
components/simulation/SimulationProvider.tsx   ← Context único com TODO o dataset
      │  dispatch(action)
lib/sim/reducer.ts            ← regras de negócio (puro, testável)
lib/sim/persistence.ts        ← localStorage + versionamento + migrações (puro no núcleo)
lib/sim/generate-*.ts         ← cadastros e cenário demo (PRNG determinístico, seed 8420)
lib/planning/{quote,plans}.ts ← cotação e alternativas (puro)
lib/data/atlas.ts             ← seletores/KPIs derivados (puro)
lib/domain/types.ts           ← contratos de domínio
supabase/migrations/*.sql     ← schema NÃO conectado
```

| Parte | Diagnóstico | Classificação |
|---|---|---|
| `lib/domain/types.ts` | Bom vocabulário; falta Route/RouteStop multi-parada, TrackingEvent, telemetria, exceção rica; status de Viagem em inglês e demais em PT | IMPROVE |
| `lib/sim/reducer.ts` | Puro e legível; bugs de regra (ver 1.4); mistura "aplicação" e "domínio" num switch de 600 linhas | REFACTOR → casos de uso por agregado |
| `lib/sim/persistence.ts` | Excelente: envelope versionado, migração incremental, validação, testes | KEEP (vira adapter `LocalStorage` do modo demo) |
| `SimulationProvider` | Context único → qualquer ação re-renderiza todas as telas; efeito com setState (erro de lint); toast de sucesso não confiável | REPLACE → store com seletores + repositórios |
| `lib/planning/*` | Motor explicável e determinístico; limitado a 1 veículo/1 viagem e 2 paradas | KEEP + evoluir |
| `lib/data/atlas.ts` | Seletores puros; KPIs com fórmulas fictícias (ver 1.4) | REFACTOR |
| Geradores demo | Bons nomes/cidades reais do Sudeste; inconsistências de estado (ver 1.4) | IMPROVE |
| `supabase/migrations` | Schema sólido (FK, índices, soft delete, `display_id`, trigger `updated_at`), mas defasado do domínio v3 e dependente de `auth.users` | REFACTOR (vira baseline Neon) |
| API routes / server actions / services / repositories | inexistentes | MISSING |
| Autenticação / autorização | inexistente; tabela `profiles` já prevê 6 papéis | MISSING |
| Estado global | 1 Context | REPLACE |
| Estado local | `useState` por tela, formulários não controlados por schema | IMPROVE |
| Error boundaries | `app/error.tsx`, `shipments/[id]/error.tsx` | KEEP |
| Integrações | nenhuma (SEFAZ, rastreador, mapas, e-mail) | MISSING (fora do escopo 2.0 exceto mapas) |
| Seed/demo | cenário Atlas + "operação vazia" separados (commit `682f1b5`) | KEEP + expandir |
| Env / deploy / CI | sem `.env.example`, README boilerplate, sem pipeline | MISSING |

### 1.3 Rotas existentes

`/` Visão Operacional · `/orders` · `/planning` · `/contratacao` · `/loads` · `/shipments` · `/shipments/[id]` · `/deliveries` · `/occurrences` · `/solicitacoes` · `/parceiros` · `/portal` (Portal do Parceiro, fora do shell lógico mas dentro do layout) · `/config/preferencias`.

Todas são prerenderizadas como casca estática e hidratam do `localStorage` — nenhuma renderiza dados no servidor.

### 1.4 Defeitos de lógica encontrados (preservar a intenção, corrigir o comportamento)

| # | Onde | Defeito | Impacto |
|---|---|---|---|
| L1 | `components/simulation/SimulationProvider.tsx:24` | Toast de sucesso é disparado mesmo quando o reducer rejeita a ação por validação (retorna o mesmo `state`); a flag `succeeded` é mutada dentro do updater de `setState`, cuja execução não é síncrona garantida | Feedback falso ("Pedido criado") |
| L2 | `lib/sim/reducer.ts:254-267` | Contratação escolhe o 1º veículo disponível em ordem de array, enquanto o planejamento (`findVehicleForWeight`) escolhe o menor que comporta → **o veículo exibido no plano difere do alocado**. Sem veículo livre, cai para `vehicles[0]` mesmo em manutenção/viagem | Alocação dupla, plano ≠ execução |
| L3 | `lib/sim/reducer.ts:265` | Opção "Frota Própria" grava `carrierId = carriers[0]` (uma transportadora terceira); opção terceirizada ainda consome veículo e motorista próprios | Atribuição errada de custo/desempenho |
| L4 | `lib/sim/reducer.ts:360-388` | Resolver 1 ocorrência devolve pedidos a "Em transporte" mesmo com outras abertas; "Devolver" leva a viagem para "At Delivery" | Estado incoerente |
| L5 | `lib/sim/reducer.ts:390` | `COMPLETE_DELIVERY` sem guarda de status (conclui viagem "Planned"); resultado sempre "Delivered"; janela planejada = ETA | Máquina de estados aberta |
| L6 | `lib/sim/reducer.ts:220` | `CREATE_LOAD` não valida origem/destino/capacidade (só a UI valida) | Regra de domínio fora do domínio |
| L7 | `lib/data/atlas.ts:22-29` | OTD = OTIF; OTIF = entregues/total (sem prazo nem "in full"); ocupação ÷ (capacidade×0,3); custo/entrega = peso×0,8 | KPIs sem significado operacional |
| L8 | `lib/data/atlas.ts` alerta `late-deliveries` | "Entrega ultrapassou a janela" conta `Failed/Returned`, não atraso | Alerta mente |
| L9 | `lib/sim/generate-atlas.ts:411` | Viagem fica "Em Exceção" com ocorrência já resolvida (observado: SHIP-000382 "Em Exceção" e Central mostrando "0 ocorrências em aberto") | Demo contradiz a si mesma |
| L10 | `lib/sim/generate-atlas.ts:438` | Fim da janela calculado a partir de *hoje*, não da data do ETA → fim < início | Dados inválidos |
| L11 | IDs | Demo usa `SHIP-000382`/`LOAD-00382`/`occ-001`; operação real usa `VIA-00001`/`CAR-00001`/`OCC-00001` | Dois padrões na mesma tela |
| L12 | `/portal` | "Acesso" do parceiro é comparação de código no cliente, com o dataset inteiro de todos os parceiros carregado no navegador | Aceitável como simulação; **inaceitável** após persistência real |

---

## 2. Current Product

### 2.1 Fluxo ponta a ponta que funciona hoje

```
Portal do Parceiro ─► Solicitação ─► (Analisar/Converter) ─► Pedido (OS completa: itens, janelas, B2B/B2C, carga refrigerada…)
                                                              │
                                                  Planejamento: seleção de pedidos compatíveis
                                                  → 3 alternativas (Consolidação / Menor custo / Nível de serviço)
                                                  → "Por que este plano?"
                                                              │
                                                  Carga ─► Contratação (cotação com composição de frete)
                                                              │
                                                  Viagem ─► Iniciar ─► Ocorrência ─► Resolver ─► Concluir entrega ─► POD simulado
```

### 2.2 Mapa de módulos

| Módulo pedido no 2.0 | Existe hoje? | Onde | Classificação |
|---|---|---|---|
| Command Center | Parcial — "Visão Operacional" em lista/cards, sem mapa | `/` | REPLACE |
| Planning | Sim, 3 colunas, sem mapa/sequência/paradas | `/planning` | REFACTOR |
| Routes | Não (Viagem tem 2 `stops` fixos) | — | MISSING |
| Shipments (Viagens) | Lista + detalhe com linha do tempo e ações | `/shipments` | IMPROVE |
| Deliveries | Lista somente leitura | `/deliveries` | IMPROVE |
| Orders | Tabela + painel lateral com histórico | `/orders` | IMPROVE |
| Loads (Cargas) | Lista | `/loads` | IMPROVE |
| Contratação (tendering) | Sim, com composição de frete | `/contratacao` | KEEP (conteúdo) / REFACTOR (UI) |
| Fleet | Não (veículos só como dado) | — | MISSING |
| Drivers | Não | — | MISSING |
| Partners | Empresas parceiras + código de acesso | `/parceiros` | IMPROVE |
| Carriers (transportadoras) | Dado sem tela | — | MISSING |
| Occurrences | Lista aberta/resolvida, sem prioridade/responsável/histórico | `/occurrences` | REFACTOR |
| Reports / KPIs | 4 KPIs na Central, fórmulas fictícias | — | MISSING |
| Settings | Reiniciar / carregar demo | `/config/preferencias` | IMPROVE |
| Documentos (CT-e, MDF-e, POD) | Só POD simulado no estado | — | MISSING (fora do escopo 2.0; manter "simulado") |

**Não inventar**: Solicitações, Parceiros, Contratação, Cargas e Planejamento já existem e têm regras — o 2.0 os reorganiza, não os recria.

---

## 3. UX Audit

Evidência: capturas em 1440×900 e 390×844 com o cenário demo carregado (`docs/orbita-2.0/baseline/`).

| Problema | Evidência | Severidade |
|---|---|---|
| **Sem navegação no mobile**: a sidebar é `hidden md:flex` e não há substituto (menu/abas). No celular só se navega pelos atalhos da Central | `mob-*.png` | Alta |
| **Sidebar com 32 itens, 21 "Em breve"** (6 grupos). Itens duplicados (Transportadoras ×2; Frota e Veículos → mesmo `/fleet`). `/contratacao` e `/portal` funcionam mas não estão no menu | `components/layout/Sidebar.tsx:19-82` | Alta |
| **Informação importante escondida**: Central não tem mapa, não mostra ETA × janela, nem risco. "Ocorrências em aberto: 0" ao lado de uma viagem "Em Exceção" | `desk-01_.png` | Alta |
| **Ações difíceis de encontrar**: iniciar viagem, registrar ocorrência e concluir entrega só existem no detalhe da viagem; nenhuma ação a partir da Central, da lista ou da ocorrência | `/occurrences`, `/shipments` | Alta |
| **Navegação excessiva**: Pedido → Planejamento → Contratação → Viagem são 4 páginas separadas para decidir 1 transporte | fluxo 2.1 | Média |
| **Feedback falso/insuficiente**: toast de sucesso em ação rejeitada (L1); ações destrutivas sem desfazer; toasts sem `aria-live` | L1, `ToastStack.tsx` | Alta |
| **Estados ausentes**: sem loading real (só "Carregando operação…"), sem skeleton, sem erro por seção, empty states só em algumas listas | geral | Média |
| **Marca duplicada**: logo na sidebar **e** no header ao mesmo tempo | `desk-*.png` | Baixa |
| **Tabelas quebram no mobile**: colunas cortadas (status some) sem rolagem nem versão em lista | `mob-06_shipments.png` | Alta |
| **Sem filtros, ordenação, busca por lista, seleção em massa** em nenhuma tabela | todas as listas | Média |
| Busca global existe (pedidos, cargas, viagens, clientes), mas sem atalho de teclado (Ctrl/⌘+K não faz nada) e sem ações | `GlobalSearch.tsx` | Média |
| Linha do tempo da viagem mostra "Em Trânsito" para status "Exception" | `shipments/[id]/page.tsx:25` | Média |
| Vocabulário misto: "LOAD-00382" exibido como "Carga", status internos em inglês | L11 | Baixa |

### Acessibilidade (medida)

| Item | Resultado |
|---|---|
| Atributos `aria-*`/`role` no app inteiro | **5** |
| Modais (Novo Pedido, confirmações) | `div` com `fixed inset-0`: sem `role="dialog"`, `aria-modal`, foco preso, Esc ou retorno de foco |
| Skip link | ausente |
| Contraste — texto de status "Em Trânsito/Em Entrega" (#aecacd) no badge | **1,48:1** (mín. 4,5) |
| Contraste — laranja #ff5b19 como texto sobre Platinum | **2,40:1** |
| Contraste — branco sobre botão laranja | **3,11:1** (falha para texto < 18px) |
| Contraste — texto `cosmic-ink/45` (legendas) | **2,80:1**; `/30` = 1,91:1 |
| Contraste — itens "Em breve" na sidebar (white/30) | 2,71:1 |
| Foco por teclado | visível (outline nativo), ordem lógica, mas sem estilo próprio |
| Tabelas | `<table>` semântico (bom), sem `caption`/`scope` |
| `lang="pt-BR"` | correto |

---

## 4. UI Audit

| Aspecto | Achado |
|---|---|
| **Cor** | 6 variáveis com nomes herdados de outra paleta (`blue-opal` é laranja; `rowdy-orange` é azul). **Ação e crítico usam a mesma cor** (#ff5b19) e **"em trânsito" e "atenção" usam a mesma cor** (#aecacd) → o operador não distingue um botão de um alarme. Sucesso usa `emerald-*` cru do Tailwind (22 usos), fora dos tokens |
| **Tipografia** | 9 tamanhos, 36 usos de `text-[11px]`/`text-[10px]` para rótulos → leitura difícil em operação. Sem escala nomeada; números com `.tabular` (bom) |
| **Spacing** | `px-6 md:px-10`, `py-2.5/3/4`, `gap-2/3/8`, `space-y-9` — sem escala; densidade baixa demais para operação (tabela de Viagens mostra 9 linhas em 900px) |
| **Radius** | `rounded-md` (57), `rounded-lg` (32), `rounded-full` (14) — sem regra de quando usar cada um |
| **Bordas/sombras** | `border-cosmic-ink/10` em tudo; sem elevação definida; modais sem sombra consistente |
| **Ícones** | praticamente ausentes (setas `→` em texto, `⌄` como caractere) |
| **Componentes** | Existem só `StatusBadge`, `WorkspaceHeader`, `OrbitaMark`, `ToastStack`. `Section`, `MiniStat`, `QueueRow`, `EmptyRow`, `ConfirmDialog`, classes de input/select são **redefinidos por página** |
| **Cards** | Central empilha 6 seções verticais de cards/listas — o problema "12 cards" em pequena escala; indicadores sem contexto (meta, tendência) |
| **Tabelas** | sem sticky header, sem densidade, sem ordenação, linhas inteiras sem ação |
| **Forms** | `NewOrderModal` com 433 linhas e validação manual; sem mensagens de erro por campo com `aria-describedby` |
| **Badges** | mapa único status→cor mistura 3 entidades; contraste insuficiente |
| **Dialogs/Drawers** | 2 modais artesanais; nenhum drawer (o painel de pedido é uma coluna fixa) |
| **Navegação** | sidebar escura fixa 288px + header claro com logo duplicado; sem breadcrumb real (só rótulo de seção) |

Positivo e a manter: identidade Charcoal + Tangerine forte e própria; `OrbitaMark` (◢ origem + movimento); Sora como display; tom de voz PT-BR cuidadoso e honesto ("frete simulado", "—" quando não há dado).

---

## 5. Database Audit

### 5.1 Schema existente (`supabase/migrations`, 21 arquivos)

18 tabelas, todas multiempresa por `company_id` (exceto filhas): `companies`, `profiles`, `locations`, `customers`, `products`, `vehicles`, `drivers`, `carriers`, `rates`, `loads`, `orders`, `order_items`, `shipments`, `load_orders`, `documents`, `deliveries`, `occurrences`, `order_events`.

| Aspecto | Estado |
|---|---|
| PKs | `uuid` + `gen_random_uuid()` (pgcrypto) — compatível com Neon |
| IDs de exibição | `display_id` único por empresa (bom — resolve L11 se o gerador seguir) |
| FKs | completas; ciclo `loads ⇄ shipments` resolvido com FK tardia (documentado) |
| Índices | por `company_id` + status; FKs principais indexadas; faltam índices em `deliveries(company_id, …)`, `order_events(entity_type, entity_id)` |
| Constraints | `check` em enums de cadastro; **status operacionais como `text` livre de propósito** (comentado em `orders.sql`) |
| Enums nativos | nenhum (usa `check`) — bom para evoluir |
| Triggers | `set_updated_at()` em todas as tabelas mutáveis |
| Soft delete | `deleted_at` em cadastros |
| **Policies / RLS** | **nenhuma** — isolamento entre empresas não é garantido pelo banco |
| **Dependência do Supabase** | `profiles.id references auth.users(id)` — não existe no Neon |
| Seeds | nenhum em SQL (o seed é o gerador TS) |

### 5.2 Defasagem schema × domínio v3

| No domínio (TS) e não no SQL | Observação |
|---|---|
| `partner_companies`, `solicitations` | módulos inteiros ausentes |
| `orders`: `operation_type`, janelas de coleta/entrega, contato, `cargo_characteristics`, temperatura, `request_date`, `pickup_date`, `notes` | OS completa (commit `92d3243`) não refletida |
| `order_items`: `description`, `unit_weight_kg` | item fora de catálogo |
| `stops` (paradas de viagem) | inexistente — bloqueia rotas |
| `tenders`, `tender_options`, `freights` | contratação e composição de frete sem tabela |
| `kpi_snapshots` | histórico de KPI |
| `locations`: `cep`, `complement`, `reference`, contato | endereço brasileiro incompleto |
| `carriers.occurrence_rate` | métrica usada no domínio |

### 5.3 Dados

- **Não há dados de produção no fluxo do app**: tudo que o usuário cria fica no `localStorage` do navegador dele.
- O projeto Supabase `orbita-tms` (`jwhunqylnoprlcyfxjaa`, sa-east-1, PG 17) está **INACTIVE (pausado)**; o conteúdo não pôde ser inspecionado sem restaurá-lo. Pelo código, o mais provável é que contenha só o schema.

---

## 6. Neon Migration Plan

Princípio: **o domínio não conhece o Neon**. A aplicação depende de interfaces de repositório; o Neon é um adapter.

```
lib/domain/        entidades, value objects, máquinas de estado, regras      (puro, sem I/O)
lib/application/   casos de uso: createOrder, planRoute, dispatchShipment…   (depende de ports)
lib/application/ports.ts  OrderRepository, ShipmentRepository, RouteRepository, Clock, IdGenerator, UnitOfWork
lib/infrastructure/
   memory/         repositórios em memória (testes + modo demo) ← reaproveita reducer/persistence atuais
   postgres/       repositórios Neon (driver serverless @neondatabase/serverless + Drizzle)
db/migrations/     SQL versionado (baseline = migrations atuais, adaptadas)
app/               server actions / route handlers chamam casos de uso; nunca SQL direto
```

Etapas (cada uma reversível e testada):

1. **Baseline** — copiar as 21 migrations para `db/migrations/` sem mudança semântica, exceto: remover `references auth.users` (substituído por `users` próprio ou Neon Auth). Aplicar num **branch Neon descartável**; `compare_database_schema` contra o esperado.
2. **Reconciliação** — migrations aditivas para 5.2 (nenhum `drop`, nenhuma constraint removida). Status operacionais passam a `check` gerado a partir da mesma fonte das máquinas de estado TS (uma lista, dois consumidores — resolve a preocupação do comentário em `orders.sql`).
3. **Novas entidades 2.0** — `routes`, `route_stops`, `tracking_events`, `vehicle_positions` (última posição), enriquecimento de `occurrences` (prioridade, impacto, responsável, entidade relacionada, ação recomendada) e `occurrence_events` (histórico).
4. **Isolamento** — `company_id` obrigatório em todo repositório (filtro no adapter) **e** RLS como defesa em profundidade, com `set_config('app.company_id', …)` por transação.
5. **Seeds** — o gerador Atlas vira seed SQL/TS idempotente para o branch `demo`; a operação vazia vira seed de cadastros.
6. **Corte** — flag `ORBITA_DATA_SOURCE=memory|postgres`. Modo demo continua funcionando sem banco. Importador opcional do `localStorage` (JSON v3 → repositórios) para quem tem operação local salva.
7. **Supabase** — só se você quiser: restaurar o projeto pausado, `pg_dump --data-only` e importar. Nada é apagado no Supabase.

Branches Neon: `main` (produção), `dev`, e **um branch efêmero por PR/CI** para testes de integração. Plano Free tem limite de 512 MB por branch — suficiente para esta fase.

---

## 7. Benchmark de produto (o que um TMS profissional faz)

Fontes oficiais consultadas ao fim do documento. Referência de **capacidade**, não de layout.

| Capacidade | Manhattan | Oracle OTM | Blue Yonder | Senior / TOTVS / Sankhya | ÓRBITA hoje | 2.0 |
|---|---|---|---|---|---|---|
| Planejamento com consolidação e escolha de modal/transportadora | ✔ contínuo | ✔ least-cost, routing guides | ✔ | ✔ | ✔ simples (3 alternativas) | evoluir: multi-parada, capacidade, janelas |
| Roteirização / sequência de paradas | ✔ | ✔ multi-leg | ✔ | ✔ roteirizador | ✘ | **novo** (sugestão + confirmação do gestor) |
| Tendering / contratação | ✔ | ✔ sequencial e broadcast | ✔ | ✔ | ✔ cotação e contratação | manter |
| Visibilidade em tempo real / ETA | ✔ | ✔ planejado × realizado | ✔ ETA preditivo | ✔ torre de controle | ✘ | **novo** (TrackingProvider + simulação) |
| **Gestão por exceção** | ✔ | ✔ desvio, expedição | ✔ "só os 5% em risco" | ✔ ocorrências | lista simples | **pilar do Command Center** |
| Frota e motoristas | ✔ dispatch & fleet | ✔ | ✔ private/dedicated fleet | ✔ | ✘ | **novo** |
| Ocorrências de entrega / POD | ✔ | ✔ | ✔ | ✔ foco BR | ✔ básico | enriquecer |
| Documentos fiscais BR (CT-e, MDF-e) | — | — | — | ✔ central | POD simulado | fora do escopo 2.0 (manter "simulado") |
| Auditoria/pagamento de frete | ✔ | ✔ | ✔ | ✔ | composição de frete | fora do escopo 2.0 |
| Analytics | ✔ | ✔ | ✔ | ✔ BI | 4 KPIs fictícios | KPIs com definição real (OTIF/OTD/ocupação) |

Leitura: o mercado converge em **"planejar → executar → ver → agir por exceção"** num mesmo lugar (Manhattan chama de *unified logistics control*; Blue Yonder e Sankhya de *torre de controle*). Os brasileiros acrescentam a realidade operacional local: ocorrência de entrega como rotina, comprovante, agendamento e documentos. A oportunidade do ÓRBITA é oferecer isso **com densidade e clareza**, sem a navegação em dezenas de telas típica dos ERPs de logística.

---

## 8. Design System Plan (Órbita DS 2.0)

Identidade preservada: **Charcoal + Tangerine** (marca), Platinum, Powder Blue, `OrbitaMark`, Sora.

Tokens em 3 níveis — `primitivos` (paleta) → `semânticos` (uso) → `componente` — em CSS custom properties expostas ao Tailwind v4 via `@theme`.

| Grupo | Decisão |
|---|---|
| Superfícies | `bg`, `surface`, `surface-raised`, `surface-sunken`, `overlay`; dois temas: **claro** (operação administrativa) e **escuro "control room"** (Command Center e Mapa), ambos com contraste AA |
| Texto | `text`, `text-muted` (≥ 4,5:1), `text-subtle` (só ≥ 18px), `text-inverse` |
| Marca/ação | `primary` = Tangerine **escurecido para AA** em texto/botão (ex. #C2410C sobre claro; #FF7A3D sobre escuro) — **Tangerine deixa de significar "crítico"** |
| Estado | `success`, `warning`, `danger` (vermelho distinto da marca), `info` |
| Domínio | `route`, `vehicle`, `shipment`, `delivery`, `exception` — usados no mapa, na timeline e nos badges, sempre acompanhados de ícone/forma (nunca só cor) |
| Tipografia | `display` (Sora 28/32), `heading` (Sora 20), `title` (16/600), `body` (14), `label` (12/500, mínimo), `caption` (12), `numeric` (tabular, mono opcional) — fim do 10–11px |
| Espaço | escala 4px (`1…12`), densidade `compact` (tabelas operacionais) e `comfortable` |
| Layout | sidebar 64/240px (recolhível), header 48px, painel de contexto 360–420px, drawer 480px, modal 480/640px |
| Forma | radius `sm 4 / md 6 / lg 10 / full`; bordas 1px `border`/`border-strong`; elevação 0–3 (sombra só em overlay/drawer/popover) |

Componentes (todos com default/hover/active/focus-visible/disabled/loading/selected/error): Button, IconButton, Input, Select, Combobox, Search, DatePicker (nativo estilizado na 1ª versão), Tabs, Badge, Status (ícone+cor+texto), KPI (valor + meta + tendência), Card, Table, DataGrid (ordenação, seleção, sticky, virtualização quando > 200 linhas), Dropdown, Tooltip, Popover, Drawer, Dialog, CommandMenu, Toast (`aria-live`), Timeline, Progress, Skeleton, EmptyState, ErrorState, LoadingState.

Base técnica recomendada: **Radix UI primitives** (acessibilidade de dialog/menu/popover/tooltip resolvida), **cmdk** (Command Menu), **lucide-react** (ícones). Tudo estilizado com os tokens próprios — sem tema pronto de terceiros. Página interna `/design-system` como catálogo vivo e alvo de QA visual.

## 9. Motion Plan

| Token | Valor |
|---|---|
| `duration-instant` | 80ms (hover, press) |
| `duration-fast` | 140ms (dropdown, tooltip, toast in) |
| `duration-base` | 200ms (drawer, dialog, tabs) |
| `duration-slow` | 320ms (troca de página, layout) |
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `ease-enter` | `cubic-bezier(0, 0, 0, 1)` |
| `ease-exit` | `cubic-bezier(0.3, 0, 1, 1)` |

Regras: entrada = opacidade + translate 4–8px; saída 30% mais rápida; escala só em overlays (0,98→1); nunca animar mais de um eixo de atenção por vez; `prefers-reduced-motion` desliga deslocamentos e mantém só opacidade. Mudança de status: flash de 600ms no badge + entrada na timeline. Inserção/remoção em tabelas: altura + fade. Mapa: interpolação contínua do veículo (rAF), rota "desenhada" uma vez ao selecionar.

Implementação: CSS transitions + keyframes com tokens na maioria dos casos; **View Transitions** do navegador para troca de página; biblioteca `motion` apenas para layout animations (reordenar paradas, listas), carregada só onde usada.

## 10. Map Architecture

```ts
interface MapProvider      { createMap(el, opts): MapHandle }             // render
interface MapHandle        { setViewport, fitBounds, setLayer(id, GeoLayer), on(event), destroy }
interface RouteProvider    { computeRoute(stops: LatLng[], opts): Promise<RouteGeometry> } // polyline, distância, duração por perna
interface GeocodingProvider{ geocode(address): Promise<GeoPoint[]>; reverse(point) }
interface TrackingProvider { subscribe(vehicleIds, onPosition): Unsubscribe; lastKnown(vehicleId) }
```

- A UI conhece só `GeoLayer` declarativo (`route`, `stops`, `vehicles`, `exceptions`) — trocar Google/MapLibre não toca telas.
- **Implementação inicial (demo)**:
  - `MapLibreMapProvider` (open source, sem chave) com estilo vetorial próprio nas cores do DS (tema escuro no Command Center). Alternativa sem rede: `SchematicMapProvider` em SVG, usado em testes e quando os tiles não carregarem.
  - `DemoRouteProvider`: geometria por interpolação geodésica entre paradas + fator de sinuosidade, velocidades por tipo de via; determinístico.
  - `DemoGeocodingProvider`: tabela de CEPs/cidades do cenário.
  - `SimulatedTrackingProvider`: posições vindas do motor de simulação.
- Futuro: `GoogleMapProvider`, `GoogleRoutesProvider` etc., escolhidos por configuração (`ORBITA_MAP_PROVIDER`).
- Performance: mapa carregado com `next/dynamic` (`ssr: false`) só nas telas que o usam; marcadores como camada GL, não DOM.

## 11. Simulation Architecture

```
SimulationClock (play/pause/reset, speed 0.5×–10×, tempo simulado)
        │ tick
RouteSimulationEngine  (puro)  state(t) = f(route, stops, serviceTimes, t)
        │ → posição, perna atual, progresso %, ETA por parada, status por parada
        │ → eventos discretos: ARRIVED_STOP, UNLOADING_STARTED, DELIVERED, DEPARTED, DELAYED
SimulationStore (useSyncExternalStore) ─► mapa (rAF, 60fps)  ─► timeline / status / ETA / painel (só em eventos)
        │
TrackingProvider (Simulated) ─► casos de uso de domínio (registrar TrackingEvent, atualizar Delivery)
```

- O motor é **função pura do tempo**: reset = t=0, velocidade = multiplicador do relógio, qualquer instante é reprodutível → testável com `node:test`.
- Máquina de estados da parada: `Pendente → Em rota → Chegou → Em descarga → Entregue | Com ocorrência`; da rota: `Planejada → Em execução → Concluída`.
- Mapa, timeline, ETA e painel leem o **mesmo** estado derivado → sincronização por construção.
- Posição do veículo re-renderiza só o marcador; telas re-renderizam só em eventos discretos.
- "Simulação" continua visivelmente rotulada (princípio honesto já presente no produto).

Dados de demonstração 2.0 (substituem/estendem Atlas, mesma seed determinística): 3 CDs (RJ, SP, BH) com rotas urbanas multi-parada — ex.: `RJ-ZONA-OESTE-042`, veículo `ORBT-014` (placa Mercosul), motorista Carlos Mendes, 5–12 paradas com clientes e janelas realistas, ocorrências coerentes com o estado, telemetria (velocidade, combustível, última atualização) e status de frota `ON ROUTE / IDLE / STOPPED / OFFLINE / MAINTENANCE` exibidos em PT-BR.

## 12. Module Redesign Plan

Todas as telas usam o mesmo esqueleto: **lista/mapa à esquerda → painel de contexto (drawer) → ações no painel**, filtros persistentes na URL, seleção em massa, atalhos.

| Módulo | Proposta |
|---|---|
| **Command Center** (`/`) | Mapa protagonista (tema escuro) + faixa de pulso da operação (veículos ativos, entregas no prazo/atrasadas, rotas em risco) + **fila de exceções ordenada por risco** com ações inline (Replanejar, Ver rota, Contatar motorista, Ver entrega). Clique em qualquer item foca no mapa e abre o painel. Tablet: mapa em cima, fila embaixo; mobile: fila primeiro, mapa em aba |
| **Planning** | Demanda (pedidos + solicitações) ↔ mapa ↔ rota em construção. Selecionar veículo/motorista, sugerir sequência, **reordenar paradas (drag + teclado)**, ver distância/tempo/capacidade/janelas/restrições em tempo real, revisar e **confirmar** (o gestor decide). Reaproveita `analyzePlanning`/`quote` |
| **Routes** | Lista + detalhe com mapa, timeline de paradas, resumo operacional, ocorrências, histórico e **modo Simulação** |
| **Shipments / Deliveries / Orders** | DataGrid com abas de estado (pendentes, planejadas, em rota, em atendimento, entregues, atrasadas, canceladas, com ocorrência), filtros e ações rápidas; Carga e Contratação viram etapas dentro do fluxo de Viagem, não páginas soltas |
| **Fleet / Drivers** | Visão operacional (estado, posição, rota, motorista, combustível, manutenção, última atualização) + cadastro |
| **Partners / Carriers** | Parceiros (existente) + Transportadoras com desempenho |
| **Occurrences** | Fila com prioridade/severidade/impacto/responsável/SLA, ação recomendada, histórico, vínculo à entidade |
| **Reports** | KPIs com definição explícita (OTIF, OTD, ocupação, custo/entrega, ocorrências por tipo) |
| **Settings** | Empresa, CDs, parâmetros, dados de demonstração |

**Novo App Shell**: sidebar em 5 áreas (Operar · Planejar · Recursos · Analisar · Configurar), só com o que existe, badges de atenção por área; header com contexto/breadcrumb, busca global e **Command Menu (⌘/Ctrl+K)** com ações ("Nova solicitação", "Ir para rota…"), notificações e usuário; navegação inferior no mobile. Remove o logo duplicado e todos os "Em breve".

## 13. Testing Strategy

| Nível | Ferramenta | Cobertura mínima |
|---|---|---|
| Unit | `node:test` (já em uso, zero dependência) | máquinas de estado (pedido, viagem, parada, ocorrência), casos de uso, cálculos de rota/ETA/capacidade, motor de simulação (tempo → estado), cotação, KPIs, persistência (11 existentes preservados) |
| Integration | `node:test` + repositórios Postgres num **branch Neon efêmero** (ou Postgres local no CI) | repositórios, isolamento por empresa/RLS, migrations sobem do zero, casos de uso ponta a ponta no banco |
| E2E | `@playwright/test` (Chromium já instalado) | login · command center · planning · criação de rota · simulação (play/pause/velocidade/sincronia) · entrega · exceção · frota; + axe-core por página |
| Visual QA | capturas Playwright em 1440/1024/768/390 com cenário determinístico | a cada fase, comparadas à linha de base |
| CI | GitHub Actions: lint → typecheck → unit → build → e2e | bloqueia merge |

Primeiro passo da Fase 1: corrigir os 2 erros de lint para `npm run lint` voltar a ser um gate confiável.

## 14. Execution Roadmap

| Fase | Entrega | Critério de aceite |
|---|---|---|
| 0 | Esta auditoria | aprovada por você |
| 1 | Arquitetura (domain/application/infrastructure, ports, repositório em memória) + Neon (baseline, reconciliação, RLS, seeds) + auth + correções L1–L12 + CI | fluxo atual idêntico em modo memória **e** Postgres; testes de integração verdes |
| 2 | Design System 2.0 + `/design-system` | todos os componentes com todos os estados; AA medido |
| 3 | Motion System | tokens aplicados; reduced-motion testado |
| 4 | App Shell (sidebar, header, busca, ⌘K, notificações, mobile nav) | navegação completa em 390px; teclado ponta a ponta |
| 5 | Command Center | exceções acionáveis sem sair da tela |
| 6 | Map + Simulation (providers, motor, controles) | mapa/timeline/ETA/painel sincronizados em 0,5×–10× |
| 7 | Planning | criar, reordenar, revisar, confirmar rota |
| 8 | Routes | detalhe + simulação |
| 9 | Shipments / Deliveries / Orders | DataGrid, filtros, massa, drawers |
| 10 | Fleet / Drivers | visão operacional + cadastro |
| 11 | Occurrences / Reports | exceção de 1ª classe; KPIs reais |
| 12 | QA geral | E2E completo, a11y, performance, visual |

Cada fase: objetivo → arquivos → implementação → testes → typecheck → lint → validação visual → correções → documentação em `docs/orbita-2.0/` → commit(s) revisáveis.

## 15. Risks

| Risco | Mitigação |
|---|---|
| Fase 1 é grande (não há backend) e pode travar o visual | Modo memória mantido; a UI 2.0 funciona sobre repositório em memória enquanto o Postgres amadurece |
| Perder o fluxo atual durante o redesign | Testes de caracterização do reducer **antes** de refatorar; E2E do fluxo 2.1 como regressão |
| Tiles de mapa dependem de rede/terceiros | `SchematicMapProvider` offline como fallback e para testes |
| Performance do mapa e da simulação | store externo + rAF só no marcador; medir antes de otimizar |
| Limite de 512 MB/branch no plano Free do Neon | suficiente agora; revisar antes de dados reais |
| Portal do Parceiro com acesso por código | vira autenticação real de usuário parceiro na Fase 1 |
| Escopo 2.0 × documentos fiscais BR | explicitamente fora; permanecem "simulados" |
| Fonte Roobert licenciada ausente | seguir com Inter até os arquivos serem fornecidos |

## 16. Dependencies

Novas dependências propostas (cada uma justificada; nenhuma instalada nesta fase):

| Pacote | Para quê | Fase |
|---|---|---|
| `@neondatabase/serverless`, `drizzle-orm`, `drizzle-kit` | adapter Postgres e migrations | 1 |
| Neon Auth (ou Auth.js) | autenticação e papéis | 1 |
| `zod` | validação de entrada nas fronteiras (server actions) | 1 |
| `@radix-ui/*` (dialog, dropdown-menu, popover, tooltip, tabs, select) | primitivos acessíveis | 2 |
| `cmdk` | Command Menu | 4 |
| `lucide-react` | ícones | 2 |
| `motion` | layout animations pontuais | 3 |
| `maplibre-gl` | MapProvider demo | 6 |
| `@playwright/test`, `@axe-core/playwright` | E2E + a11y | 1 (infra) / 12 |

Externas: projeto Neon (criar), provedor de tiles para o mapa demo, e — só se desejado — restauração do Supabase pausado.

---

## Decisões pendentes

Antes da Fase 1:

1. **Persistência**: confirmar que a Fase 1 inclui criar backend (server actions + repositórios + Neon), mantendo o modo demo em memória/localStorage.
2. **Supabase pausado** (`orbita-tms`): tem dados que precisam vir para o Neon? Se sim, autorizar restaurar e exportar; se não, usar só as migrations do repositório.
3. **Autenticação**: Neon Auth (recomendado, alinhado ao Neon) ou Auth.js.
4. **Mapa demo**: MapLibre + tiles (recomendado, tema próprio) ou só esquemático offline.
5. **Projeto Neon**: criar um novo `orbita-tms` (região `aws-sa-east-1`).

---

## Fontes do benchmark

- Manhattan — [Transportation Management System](https://www.manh.com/solutions/supply-chain-management-software/transportation-management), [Manhattan Active TM](https://www.manh.com/en-in/products/manhattan-active-transportation-management)
- Oracle — [OTM Data Sheet](https://www.oracle.com/a/ocom/docs/applications/supply-chain-management/oracle-transportation-management-cloud-ds.pdf), [Transportation Operational Planning](https://www.oracle.com/a/ocom/docs/applications/supply-chain-management/oracle-transportation-operational-planning-ds.pdf)
- Blue Yonder — [Transportation Execution](https://blueyonder.com/solutions/transportation-management/transportation-execution), [Transportation Management](https://blueyonder.com/en/solutions/transportation-management)
- Senior — [TMS Gestão de Transportes](https://site.senior.com.br/sistema-de-logistica/tms-gestao-de-transportes/), [Roteirizador de Entregas](https://site.senior.com.br/sistema-de-logistica/roteirizador-de-entregas/), [Torre de Controle](https://www.senior.com.br/solucoes/torre-de-controle)
- TOTVS — [TOTVS Logística TMS](https://produtos.totvs.com/ficha-tecnica/tudo-sobre-o-totvs-logistica-tms/), [MDF-e para CT-e](https://centraldeatendimento.totvs.com/hc/pt-br/articles/360019631891-Log%C3%ADstica-Linha-Protheus-TMS-Procedimento-para-emitir-um-MDF-e-para-CT-e)
- Sankhya — [Sankhya Log](https://www.sankhya.com.br/software-de-gestao-erp/erp-para-gestao-empresarial/jornada/sankhya-log/), [TMS (ajuda)](https://ajuda.sankhya.com.br/hc/pt-br/articles/26072911596183-TMS)
