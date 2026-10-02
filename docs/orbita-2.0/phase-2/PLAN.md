# ÓRBITA 2.0 — Fase 2 · Plano do Órbita Design System 2.0

> Proposta para aprovação. Baseada no [GAP-REPORT](GAP-REPORT.md) e na [análise das referências visuais](REFERENCES.md) (cujos 14 princípios de UI/UX valem junto com a seção 1). Nada foi implementado ainda.
> Escopo: **camada de experiência**. Domínio, reducer, application layer, repositórios, Neon/Auth/RBAC, Demo × Produção, provedores de mapa/rota/rastreamento, motor de simulação e testes ficam intactos. A UI continua consumindo só `useOperation()` e as portas de `lib/geo`.

---

## 1. Princípios (extraídos do benchmark, não copiados)

| Princípio | Regra prática | De onde vem |
|---|---|---|
| **Densidade com calma** | Tabela compacta (36px/linha) como padrão operacional; hierarquia por peso e tom, não por caixas. Uma tela de 1440×900 mostra ≥ 18 viagens. | Datadog, Manhattan, Linear |
| **O crítico domina** | Em cada tela, a exceção mais grave é o elemento de maior contraste. Cor saturada só para estado — nunca para decoração. | Oracle OTM (exception mgmt), Datadog |
| **Agir onde se vê** | Toda entidade abre num **drawer** com as ações dela. Nenhuma ação operacional exige trocar de página. | Linear, Stripe, Ramp |
| **Seleção compartilhada** | Mapa, fila, tabela e drawer leem a mesma seleção. Clicar num lugar acende nos outros. | Blue Yonder control tower |
| **Feedback imediato e reversível** | Toda ação: estado otimista + toast com resultado real + "Ver"/"Desfazer" quando o domínio permitir. | Linear, Vercel |
| **Movimento explica mudança** | Animação só quando algo mudou de estado ou de lugar. Nada decorativo. Respeita `prefers-reduced-motion`. | Raycast, Linear |
| **Teclado primeiro** | ⌘K para tudo; `J/K` navega linhas, `Enter` abre, `Esc` fecha, `?` mostra atalhos. | Linear, Raycast |
| **Honestidade** | "Simulação", "estimativa", "—" quando não há dado: o tom atual do produto é mantido. | ÓRBITA (já existente) |

Superfícies, não cartões: **app chrome** (sidebar/header) → **workspace** (fundo) → **regiões de dados** (tabela, mapa, fila — sem borda própria, separadas por 1px) → **painéis/drawers** (elevação 2) → **overlays** (dialog, ⌘K, popover — elevação 3). Card só onde o objeto é de fato independente (ex.: alternativa de plano).

---

## 2. Tokens

Três camadas em CSS custom properties expostas ao Tailwind v4 via `@theme`: **primitivos** (paleta) → **semânticos** (uso) → **componente**. Os nomes legados (`cosmic-ink`, `blue-opal`, `cinnamon`…) são removidos ao fim da fase — cada tela migrada deixa de usá-los.

### 2.1 Cor — papéis

| Papel | Uso | Proposta (claro) | Regra |
|---|---|---|---|
| `neutral` | texto, bordas, superfícies | escala Charcoal 50–950 (quente, derivada de #161616 / Platinum) | texto secundário ≥ 4,5:1 sempre |
| `primary` | **ação** (botão primário, link de ação, foco) | **Charcoal 900 #161616** sólido; link #161616 sublinhado | nunca usado para estado |
| `brand` | marca, indicador de seleção (barra de 2px), rota ativa | Tangerine #FF5B19 (só gráfico ≥ 3:1) · texto **#B83A0B** (≥ 4,5:1) | não comunica status |
| `info` | em rota, em trânsito, chegou | azul #1F5FCC | — |
| `success` | entregue, no prazo, resolvida | verde #11753F | — |
| `warning` | em risco, aguardando, janela apertada | âmbar — fundo #FCEFC7, texto #7A4B00, gráfico #B87500 (claro) · #E0A100 (mapa escuro) | com ícone triângulo |
| `danger` | atrasada, falhou, devolvida | vermelho — fundo #FDE7E6, texto #B42318 | com ícone |
| `critical` | roubo, acidente, extravio, parada > SLA | **sólido** #9B1C1C, texto branco, pulso único na entrada | escalonamento de `danger` por *preenchimento*, não só por tom |
| `route` | linha da rota no mapa | Tangerine (ativa) · Charcoal 400 (demais) · Charcoal 300 (percorrido) | — |
| `delivery` | marcador/ícone de entrega | teal #0E7490 | — |
| `vehicle` | veículo | Charcoal 900 + seta branca; selecionado com halo Tangerine | — |
| `exception` | desvio operacional no mapa/timeline | violeta #6D28D9 | distinto de `danger` (exceção ≠ falha) |

Separação pedida resolvida: **ação = Charcoal**, **crítico = vermelho sólido**, **marca = Tangerine** (que deixa de significar qualquer status). Todo status é **ícone + texto + cor**. Os valores finais são validados por script (WCAG 2.2 AA: texto 4,5:1, texto grande e gráficos 3:1) e o script entra no `npm test`.

Mapa: estilo **claro e dessaturado** (base Platinum, vias brancas, água azul-acinzentada; Google Map ID e esquemático com as mesmas cores), para que as cores de estado validadas em fundo claro valham também no mapa. O tema escuro ("parede de monitoramento") fica preparado nos tokens, não entregue nesta fase.

### 2.2 Tipografia

| Token | Fonte | Tamanho/linha · peso | Uso |
|---|---|---|---|
| `display` | Sora | 28/36 · 600 | número-herói da Central |
| `h1` | Sora | 20/28 · 600 | título de workspace |
| `h2` | Inter | 15/22 · 600 | título de seção/painel (sentence case, sem caixa-alta) |
| `h3` | Inter | 13/20 · 600 | subtítulo, cabeçalho de grupo |
| `body` | Inter | 14/20 · 400 | padrão |
| `body-sm` | Inter | 13/18 · 400 | células de tabela compacta, meta |
| `label` | Inter | 12/16 · 500 | rótulos de campo, cabeçalho de tabela |
| `caption` | Inter | 12/16 · 400 | auxiliar (mínimo absoluto: **12px**) |
| `numeric` | Inter tabular | herda tamanho · 500–600 | contagens, %, moeda |
| `mono` | **Geist Mono** | 12–13 · 500 | IDs (VIA-00004, PED-00021), placa (RJT3P27), código de rota, ETA, km, km/h |

Fim de 10–11px. Sora fica para títulos e número-herói; dados nunca em Sora.

### 2.3 Espaço, forma, elevação

- **Espaço**: base 4px — `0, 0.5(2), 1(4), 1.5(6), 2(8), 3(12), 4(16), 5(20), 6(24), 8(32), 10(40), 12(48)`. Densidade `compact` (linha 36px) e `comfortable` (44px). Gutter de workspace 24px desktop / 16px mobile.
- **Radius**: `xs 2` (badge, tag) · `sm 4` (input, botão) · `md 6` (popover, menu) · `lg 10` (dialog, drawer no mobile) · `full` (avatar, ponto de status). Regiões de dados: 0.
- **Bordas**: `border-subtle` (separador de linha), `border` (controles), `border-strong` (foco de região). Sempre 1px.
- **Elevação**: 0 (workspace e regiões) · 1 (header fixo, sticky) · 2 (drawer, painel flutuante sobre mapa) · 3 (dialog, ⌘K, popover, toast). Sombra só em 2–3.
- **Layout**: sidebar 232px / 56px recolhida · header 48px · drawer 440px (desktop) / sheet (mobile) · dialog 480/640px.

### 2.4 Motion

| Token | Valor | Uso |
|---|---|---|
| `instant` | 80ms | hover, press |
| `fast` | 140ms | tooltip, dropdown, toast in, filtro do ⌘K |
| `base` | 200ms | drawer, dialog, tabs, troca de linha selecionada |
| `slow` | 320ms | troca de contexto (View Transitions), layout |
| `ease-standard` | cubic-bezier(.2,0,0,1) | movimentos em geral |
| `ease-enter` | cubic-bezier(0,0,0,1) | entradas |
| `ease-exit` | cubic-bezier(.3,0,1,1) | saídas (30% mais curtas) |

Padrões: entrada = opacidade + 4–8px; overlay 0,98→1; **mudança de status** = flash de 600ms no badge + entrada do evento na timeline; **inserção/remoção em tabela** = altura + fade; **veículo** = interpolação contínua por rAF já existente + rotação suavizada do heading (sem saltos); **rota selecionada** desenhada uma vez. Implementação: CSS + View Transitions + WAAPI; sem biblioteca de animação.

---

## 3. Componentes

Base: **Radix UI primitives** (Dialog, Popover, DropdownMenu, Tooltip, Tabs, Select, Toast — acessibilidade e foco resolvidos) + **cmdk** (⌘K) + **lucide-react** (ícones). Tudo estilizado com tokens próprios. Sem tema pronto.

Button · IconButton · Input · Select · Combobox · Search · DatePicker (nativo estilizado + máscara pt-BR) · SegmentedControl · Tabs · Badge · **Status** (por entidade: pedido, carga, viagem, parada, entrega, ocorrência) · KPI (valor + meta + tendência + definição) · **DataTable** (ordenação, filtros na URL, seleção, sticky, densidade, teclado, cartões no mobile) · Dropdown · Tooltip · Popover · **Drawer** · Dialog / ConfirmDialog · **CommandMenu** · Toast (`aria-live`, tom, ação) · **Timeline** · Progress (linear + segmentado por paradas) · Skeleton · EmptyState · ErrorState · LoadingState · KeyValue · SectionHeader.

Vindos das referências ([REFERENCES](REFERENCES.md)): FilterChip · StatusDistributionBar · RiskMeter · MapOverlay · MapPeek · HeatStrip · LaneLabel · NavCount · FreshnessIndicator · SegmentedCounter · EntityRow · MetricGrid · TripProgress · ActivityTimeline · MapControls · VehicleLabel · TimeAnchorRow.

Cada um com default / hover / active / focus-visible / disabled / loading / selected / error. Catálogo vivo em **`/design-system`** (rota interna, fora do menu) — alvo do QA visual e da regressão por screenshot.

---

## 4. Arquitetura de informação (nova navegação)

Analisando domínio + RBAC (7 papéis): o operador trabalha em três tempos — **durante** (execução), **antes** (demanda e planejamento), **com o quê** (recursos). Proposta:

```
OPERAÇÃO        Command Center      /
                Mapa                /mapa
                Viagens             /shipments
                Entregas            /deliveries
                Ocorrências         /occurrences        ● badge de abertas
PLANEJAMENTO    Pedidos             /orders             abas: Todos · Caixa de entrada (solicitações) ● badge
                Planejamento        /planning           etapas: Demanda → Carga → Contratação
                Cargas              /loads              drawer com "Contratar"
RECURSOS        Frota               /fleet              abas: Veículos · Motoristas
                Transportadoras     /carriers
                Parceiros           /parceiros
CONFIGURAÇÃO    Preferências        /config/preferencias
```

Decisões:
- **Sem "Em breve"**: só entra no menu o que existe. 34 → 12 itens.
- **Solicitações** viram a aba "Caixa de entrada" de Pedidos (`/solicitacoes` redireciona).
- **Contratação** deixa de ser página solta: é a etapa 3 do Planejamento e a ação "Contratar" no drawer da Carga (`/contratacao` redireciona para Cargas filtradas "aguardando contratação").
- **Frota, Motoristas, Transportadoras**: telas novas **somente de leitura/operacionais** sobre dados que já existem (`vehicles`, `drivers`, `carriers`) — status, viagem atual, motorista, desempenho. Nenhuma regra nova.
- **Análise** e **Acesso** ficam fora nesta fase: não há telas reais. KPIs vivem no Command Center com definição explícita.
- Itens filtrados por RBAC (`can()`), não apenas ações.

---

## 5. App Shell

- **Sidebar** 232px clara-sobre-Charcoal, recolhível para 56px (ícones + tooltip), com marca única, grupos acima, badges de atenção, troca de empresa/modo no rodapé (Modo Demo visível aqui, não no header).
- **Header 48px**: breadcrumb navegável · busca (abre ⌘K) · notificações (popover com ocorrências e eventos recentes, contador) · "Novo" (dropdown: Pedido, Viagem a partir de carga…) · perfil (nome, papel, sair).
- **Skip link**, `main` único, títulos em hierarquia, foco visível consistente (anel 2px Charcoal + offset, 3:1 garantido).
- **⌘K / Ctrl+K**: grupos *Ir para* (todas as áreas), *Buscar* (pedido, viagem, carga, veículo/placa, motorista, cliente, ocorrência — por ID, nome, placa, código de rota), *Criar* (pedido, planejamento), *Ações no contexto* (na viagem aberta: iniciar, registrar ocorrência, ver no mapa), *Filtros prontos* ("Viagens atrasadas", "Ocorrências críticas", "Cargas aguardando contratação") — este último é o gancho para a busca semântica futura. Recentes no topo. Respeita RBAC.

### Mobile
- **Bottom navigation** (5): Central · Mapa · Viagens · Ocorrências · Mais (sheet com o resto).
- Header compacto 48px com título da tela + ⌘K + notificações.
- Drawer → **sheet** de baixo para cima com alças (meia altura / tela cheia).
- Tabelas → **lista de cartões** com os 3 campos mais importantes + status (mesmo componente DataTable).
- Mapa → tela cheia com controles flutuantes de 44px, painel da rota em sheet, simulação recolhível.
- Alvos de toque ≥ 44px.

---

## 6. Command Center (`/`)

Mapa como canvas; os dados entram em camadas.

```
┌ Header ─ Command Center ─────────────────────── ⌘K  🔔 2   + Novo  ●Perfil ┐
│┌ FILTROS ───────────────────────────────────────────┐ ┌ AGORA · 3 ───────┐│
││ 🔍 Viagem, rota, placa │● No prazo 14 │▲ Em risco 2 │ │ 82 ▬▬▬▬ ⛔        ││
││ ⛔ Exceção 1 │ Fila de planejamento 8 │ ▶ Simulação │ │ SP-ZONA-OESTE-017 ││
│└────────────────────────────────────────────────────┘ │ CD SP → Santana   ││
│                                                       │ Atraso aberto há  ││
│        MAPA (claro, dessaturado)                      │ 34 min; parada 2  ││
│        veículos com heading, rotas, paradas,          │ prevista 00:52,   ││
│        exceções; clique → prévia ancorada             │ janela até 00:30  ││
│              ┌ prévia ─────────────┐                  │ [Resolver][Abrir] ││
│              │ RJ-ZONA-OESTE-042   │                  │───────────────────││
│              │ Parada 3 fora da    │                  │ 61 ▬▬▬ ▲ RJ-ZO-042││
│              │ janela · ETA 01:52  │       [+][−][⌖]  │ 40 ▬▬  ▲ BH-CS-008││
│              │ [Abrir]             │       [Seguir]   │ Ver todas →       ││
│              └─────────────────────┘                  └───────────────────┘│
│┌ PRÓXIMAS 6 H ────────────────────────────────────────────────────────────┐│
││ 2 janelas em risco │ ░░▓▓█░░░▓░░  00h 01h 02h 03h 04h 05h │ Em execução ⌄││
│└──────────────────────────────────────────────────────────────────────────┘│
└ Simulação · atualizado há 1 s ─────────────────────────────────────────────┘
       prévia → "Abrir" → drawer da viagem (TripProgress, MetricGrid, timeline, ações)
```

- **Filtros de status com contagem** (FilterChip) filtram mapa, "Agora" e a tabela ao mesmo tempo; estado na URL.
- **"Agora"**: fila ordenada por **índice de atenção** determinístico (atraso projetado vs janela pelo motor de simulação + severidade da ocorrência aberta + prioridade do pedido), calculado na camada de apresentação, sempre com o motivo em uma frase e no máximo 2 ações (as que o domínio já tem e o papel permite).
- **"Próximas 6 h"** (HeatStrip): janelas de entrega em risco por hora, derivadas das ETAs simuladas. Expande para a **tabela de execução** (rota, veículo, motorista, TripProgress, próxima parada, ETA × janela, atraso).
- **Feed de atividade** (ActivityTimeline) no popover de notificações e no drawer.
- **Seleção compartilhada** mapa ↔ "Agora" ↔ tabela ↔ drawer; cor de seleção = Tangerine.
- ≥ 1440: painéis flutuam. 1024–1439: acoplam às bordas (mapa ≥ 50% da área). Tablet: mapa em cima, "Agora" e horizonte embaixo. Mobile: "Agora" primeiro, mapa e execução em abas.
- Estado vazio mantém o fluxo atual ("Novo Pedido" / "Carregar cenário").

## 7. Mapa e simulação

Mantidas as portas (`MapProvider`, `MapHandle`, `RouteProvider`, `TrackingProvider`) e o motor. Mudanças na camada de apresentação, com extensões **aditivas** em `lib/geo/types.ts` (ex.: `kind: "exception"`, `polyline kind: "route-done"` já existe) e em `marker-style.ts`:

- Marcadores: veículo (seta com heading suavizado, halo quando selecionado, rótulo com placa no zoom alto), parada pendente / ativa (anel pulsante) / concluída (check) / atrasada (âmbar) / exceção (violeta, ícone), origem (CD, quadrado). Numeração única `CD, 1, 2…` em todo o produto.
- Rota: trecho percorrido × restante; demais rotas esmaecidas; agrupamento (cluster) de veículos/paradas abaixo de um zoom.
- Comportamentos: auto-fit na seleção, **seguir veículo** (toggle), recentrar, legenda, aviso "mapa esquemático" como chip discreto.
- `OperationalMap` reutilizável: Command Center, `/mapa`, Viagem e Planejamento (pré-visualização da rota em construção).
- **Simulação**: barra com ▶/❚❚/↺ (ícones + rótulo acessível), 0,5×–10×, relógio simulado, e para o veículo selecionado: posição, heading, velocidade, progresso, próxima parada, ETA, atraso vs janela, timeline de paradas sincronizada. Atalho: `Espaço` play/pause.

## 8. Fluxos redesenhados

| Fluxo | Hoje | Proposto |
|---|---|---|
| **Pedido** | modal longo, valida no envio | Dialog em 3 passos (Operação · Coleta · Entrega/Itens) com resumo lateral sempre visível, validação por campo, `⌘Enter`, "Criar e criar outro", rascunho local |
| **Carga** | Planejamento em 3 colunas vazias | Planejamento em etapas: seleção de demanda (tabela com filtros e compatibilidade) → alternativas lado a lado com mapa da rota → confirmação. Criar carga também a partir da seleção em Pedidos |
| **Contratação** | página de cards | Etapa e drawer comparativos: custo total e composição (frete-peso, Ad Valorem, GRIS, pedágio, TDE), prazo, SLA/OTIF da transportadora, veículo e motorista (frota própria), condições — recomendação destacada e explicada |
| **Viagem** | página longa com cards | Header operacional (rota, status, veículo, motorista, progresso, ETA final, atraso) + mapa + timeline de paradas + ocorrências + pedidos + barra de ações (Iniciar, Registrar ocorrência, Concluir entrega) |
| **Entrega** | tabela de resultados | Fila do dia por status (a caminho / na janela / atrasada / concluída) com janela × ETA, cliente, POD; drawer com histórico e comprovante |
| **Ocorrência** | lista que só navega | Fila acionável por severidade e tempo aberto; drawer com contexto (viagem, parada, mapa mini), ação recomendada e resolução em 1 clique |

## 9. Acessibilidade (critério de aceite em cada commit)

Contraste AA validado por script; foco visível em tudo; Dialog/Drawer/⌘K com trap, Esc e retorno de foco (Radix); `aria-live` em toasts e mudanças de status; landmarks e skip link; rótulos e erros por campo com `aria-describedby`; status nunca só por cor; navegação de tabela por teclado; `prefers-reduced-motion`. **`@axe-core/playwright` no E2E** com zero violações sérias/críticas nas telas principais.

## 10. Implementação — commits

| # | Commit | Conteúdo | QA visual |
|---|---|---|---|
| 1 | `feat(ui): establish design tokens` | tokens, fontes (Geist Mono), script de contraste no `npm test` | — |
| 2 | `feat(ui): rebuild primitives` | componentes + `/design-system` | catálogo 4 viewports |
| 3 | `feat(ui): rebuild navigation` | IA nova, sidebar, bottom nav, redirects | ✔ |
| 4 | `feat(ui): rebuild app shell` | header, breadcrumb, notificações, perfil, ⌘K | ✔ |
| 5 | `feat(ui): rebuild operational map` | `OperationalMap`, marcadores, follow, cluster, simulação | ✔ |
| 6 | `feat(ui): rebuild command center` | pulso, mapa, exceções, execução, drawer | ✔ |
| 7 | `feat(ui): rebuild trip experience` | viagem + lista de viagens | ✔ |
| 8 | `feat(ui): rebuild planning` | pedidos, caixa de entrada, planejamento, cargas, contratação, Novo Pedido | ✔ |
| 9 | `feat(ui): rebuild fleet` | frota, motoristas, transportadoras, parceiros | ✔ |
| 10 | `feat(ui): rebuild delivery experience` | entregas | ✔ |
| 11 | `feat(ui): rebuild exception experience` | ocorrências | ✔ |
| 12 | `feat(ui): add motion system` | consolidação e documentação do motion | ✔ |
| 13 | `test(e2e): visual regression coverage` | screenshots por viewport, axe, E2E atualizados | relatório final |

Cada commit: lint · typecheck · unitários · build · E2E demo (ajustando seletores quando o texto mudar, sem perder cobertura). Capturas em `docs/orbita-2.0/phase-2/qa/` comparadas com `audit/`.

## 11. Dependências novas

| Pacote | Por quê |
|---|---|
| `@radix-ui/react-{dialog,popover,dropdown-menu,tooltip,tabs,select,toast}` | acessibilidade de overlays sem reinventar |
| `cmdk` | Command Menu |
| `lucide-react` | ícones consistentes |
| `@axe-core/playwright` (dev) | a11y no E2E |

Nenhuma biblioteca de UI pronta, nenhuma lib de animação, nenhuma mudança de backend.

## 12. Riscos

| Risco | Mitigação |
|---|---|
| E2E dependem de textos/papéis atuais ("+ Novo Pedido", "Iniciar Viagem") | manter nomes acessíveis das ações; atualizar seletores no mesmo commit |
| Fase grande | ordem acima entrega valor a cada commit; nenhuma tela fica "meio velha, meio nova" no fim de um commit |
| Mapa real (Google) não testável aqui sem chave | QA visual no esquemático; estilos via `marker-style.ts` compartilhado pelos dois provedores |
| Problema funcional encontrado no caminho | registrado em `phase-2/FINDINGS.md`; corrigido só se bloquear a experiência ou causar regressão |
