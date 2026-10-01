# ÓRBITA 2.0 — Fase 2 · UI/UX GAP REPORT

> Auditoria visual feita em 01/10/2026 sobre a branch `claude/amazing-dijkstra-snacv5` (Fase 1 concluída).
> Modo Demo, cenário de demonstração carregado, mapa esquemático (sem chave do Google, mesmo modo do E2E).
> Capturas em `audit/`: **desktop 1440×900 · laptop 1280×800 · tablet 834×1112 · mobile 390×844**, 15 telas + estados (vazio, busca, Ctrl+K, Novo Pedido, página inteira no mobile).
> Linha de base técnica antes de qualquer mudança: lint 0/0 · typecheck limpo · 69/69 unitários · build OK (20 rotas).

## 0. Resumo em 10 linhas

1. O produto **funciona**, mas parece um **CRUD organizado**, não uma central de transporte. A Central é uma pilha de seis seções (contadores → alertas → listas → indicadores → atividade → atalhos) e **não tem mapa**.
2. **O mapa da Fase 1 é o melhor pedaço do produto** e está isolado em `/mapa`, desconectado da Central, das Viagens e das Ocorrências.
3. **Cor sem semântica**: a mesma tangerina significa *botão primário*, *item ativo do menu*, *pedido planejado*, *ocorrência* e *severidade "Baixa"*. O Powder Blue significa *em trânsito* e *atenção*. **Nenhum badge de status passa no WCAG AA** (1,47:1 no pior caso).
4. **Mobile não tem navegação**: a sidebar some (`hidden md:flex`) e nada a substitui. 4 tabelas estouram a largura em 390px e escondem a coluna de situação.
5. **Sidebar com 34 itens, 22 "Em breve"**, dois grupos duplicados (Transportadoras ×2, Frota = Veículos) e dois itens que acendem juntos (Mapa Operacional + Rotas no mapa).
6. **Ações longe do contexto**: iniciar viagem, registrar/resolver ocorrência e concluir entrega só existem dentro do detalhe da viagem. Da Central, da lista de Ocorrências e do mapa não se age.
7. **Não existe Design System**: 4 componentes compartilhados; `Section`, `MiniStat`, `DetailField`, `inputClass`, `EmptyRow` e o título de seção (`uppercase tracking-wider text-cosmic-ink/50`, 18 cópias) são redefinidos por página. 9 tamanhos de fonte, 35 usos de 10–11px, 22 opacidades diferentes de `cosmic-ink`.
8. **Diálogos inacessíveis**: Novo Pedido é uma `div fixed` sem `role="dialog"`, sem foco preso, **Esc não fecha** (verificado), sem retorno de foco. **Ctrl/⌘+K não faz nada** (verificado).
9. **Sem estados**: não há skeleton, loading por região, erro por região nem toast de erro diferenciado; empty states existem só em parte das listas.
10. **Movimento**: só o veículo no mapa anima. Mudança de status, inserção em tabela, toast, drawer — tudo aparece/desaparece seco.

---

## 1. Inventário de telas

| Rota | Tela | Papel atual | Veredito |
|---|---|---|---|
| `/` | Visão Operacional | 6 seções empilhadas, sem mapa | **Reconstruir** como Command Center |
| `/mapa` | Mapa Operacional | lista de rotas · mapa · painel · simulação | **Promover** a componente de 1ª classe; reaproveitar dentro da Central e da Viagem |
| `/solicitacoes` | Solicitações Recebidas | cards de solicitação + convertidas | **Fundir** em Pedidos como aba "Caixa de entrada" |
| `/orders` | Pedidos | tabela + painel lateral fixo | **Refazer** como DataGrid + Drawer |
| `/planning` | Planejamento | 3 colunas; 2/3 da tela vazios até selecionar | **Refazer** como fluxo em etapas (Demanda → Carga → Contratação) |
| `/contratacao` | Contratação | lista de cards de cotação | **Absorver** como etapa do planejamento e ação no drawer da Carga |
| `/loads` | Cargas | tabela simples | **Refazer** como DataGrid + Drawer (com "Contratar") |
| `/shipments` | Viagens | tabela de 5 colunas, 9 linhas por tela | **Refazer** como DataGrid operacional (progresso, próxima parada, ETA × janela) |
| `/shipments/[id]` | Viagem | timeline genérica de 5 etapas, paradas, 4 cards, ocorrências | **Reconstruir** como experiência de viagem (mapa + timeline de paradas + ações) |
| `/deliveries` | Entregas | tabela de resultados | **Reconstruir** com experiência própria (fila do dia, janela, POD) |
| `/occurrences` | Ocorrências | lista aberta/resolvida, só navega | **Reconstruir** como fila acionável |
| `/parceiros` | Empresas Parceiras | form + lista | **Refazer** com primitives (Recursos) |
| `/config/preferencias` | Preferências | controles do Modo Demo | **Refazer** com primitives |
| `/portal` | Portal do Parceiro | card centralizado; sem `main`, sem `h1`, input sem rótulo | **Refazer** (shell próprio, acessível) |
| `/auth/sign-in`, `/acesso-pendente` | Autenticação | — | **Refazer** com primitives (Modo Produção) |
| — | Frota, Motoristas, Transportadoras | **não existem**; os dados existem (`vehicles`, `drivers`, `carriers`) | **Criar visão operacional** sobre os dados existentes (sem novas regras) |

---

## 2. Gap por dimensão

### Navigation
- Sidebar escura de 288px com 2 atalhos + 6 grupos (**34 itens**); 22 levam a `#` com selo "Em breve" (contraste 2,70:1).
- Duplicidades: "Transportadoras" em Planejamento e Cadastros; "Frota" e "Veículos" → `/fleet`; "Mapa Operacional" e "Rotas no mapa" → `/mapa` (os dois acendem juntos, ver `desktop-mapa.png`).
- `/contratacao` e `/portal` funcionam e **não estão no menu**.
- Logo duplicado (sidebar **e** header).
- Sem breadcrumb real: o rótulo em caixa-alta acima do título não é navegável e mistura conceitos ("Central Operacional", "Operações", "Operações · Viagens" para a mesma família de telas).
- Sem ícones: grupos usam `⌄` e `›` como caracteres.
- Sem indicação de atenção por área (ex.: 1 ocorrência aberta não aparece no menu).

### Information Architecture
- A sidebar segue a **lista de cadastros**, não o **trabalho do operador**. O domínio tem três tempos — *antes* (demanda/planejamento), *durante* (execução), *recursos* — e a navegação não reflete isso.
- O ciclo Pedido → Planejamento → Contratação → Viagem atravessa **4 páginas** para uma decisão.
- Solicitações (do Portal) e Pedidos são a mesma fila de demanda em dois lugares.
- KPIs (OTIF, OTD, ocupação, custo/entrega) aparecem sem meta, tendência ou definição; "Indicadores Principais" linka para `/kpis`, que não existe.

### Typography
- 9 tamanhos em uso (10, 11, 12, 14, 15, 16, 18, 20, 24px). **299 nós de texto em 10–11px** só no desktop.
- Sem escala nomeada; Sora usada em títulos **e** em IDs de linha (`font-display` em PED-00021) — mistura papel de marca com dado.
- Dados operacionais (IDs, placas, ETA, km, km/h, códigos de rota) sem tratamento próprio: só `.tabular` em parte deles.
- Caixa-alta + tracking em todo título de seção — reduz legibilidade e compete com o conteúdo.

### Color
| Problema | Medido |
|---|---|
| Ação primária = item ativo = "Planejado" = "Com ocorrência" = severidade "Baixa" (todos `#ff5b19`) | — |
| "Em trânsito" e "Atenção" = `#aecacd` | — |
| Badge "Em Trânsito / Em Entrega" | **1,47:1** |
| Alerta de atenção ("1 carga aguarda contratação") | **1,31:1** — praticamente invisível |
| Badge tangerina (Planejado / Com ocorrência / Em Exceção) | **2,47:1** |
| Link tangerina ("Ver Opção", "Analisar") | **2,81:1** |
| Branco sobre botão tangerina | **3,11:1** (texto 14px) |
| Texto `ink/45` (meta, vazios) · `ink/50` (cabeçalho de tabela) · `ink/55` | 2,80 · 3,35 · 3,73:1 |
| Placeholder `ink/40` | 2,56:1 |
| Prioridade "Alta" (cinza claro) — mais apagada que "Normal" | 2,20:1 |
| Sucesso usa `emerald-*`, mapa usa `red-700`/`blue-700` crus do Tailwind, fora dos tokens | — |
| Ocorrências: cor do texto de severidade codifica **resolvida/aberta**, não severidade (Média resolvida em verde, Baixa aberta em laranja) | `desktop-occurrences.png` |

### Spacing
- Sem escala: 53 valores distintos de `p/px/py/gap/space/m` em uso, incluindo `py-2.5`, `py-1.5`, `mt-0.5`, `px-2.5`.
- Mesmo padrão com ritmos diferentes: título de seção com `mb-3` na Central e `mb-4` na timeline; listas com `py-3` e `py-2.5`.
- Gutter de página `px-6 md:px-10` + `max-w-3xl/4xl` arbitrários por tela (Ocorrências e Viagem usam metade da tela no desktop).

### Density
- Viagens: **9 linhas visíveis** em 1440×900; Pedidos: 14 linhas a 49px/linha.
- Planejamento: 2 de 3 colunas vazias até a primeira seleção.
- Contratação: 4 cotações ocupam a tela inteira em cards de 100px.
- Central: 4 contadores ocupam 80px de altura cada para mostrar um número.

### Components
- Compartilhados hoje: `StatusBadge`, `WorkspaceHeader`, `OrbitaMark`, `ToastStack`.
- **Redefinidos por arquivo**: `Section`, `MiniStat`, `QueueRow`, `EmptyRow`, `DetailField` (×2), `MiniField` (×2), `Field`, `FormSection`, `PriorityTag`, `PlanCard`, `BreakdownRow`; classe de input copiada em 4 arquivos; título de seção copiado 18×.
- Ícones: 2 SVGs inline (busca, mais); setas `→` como texto.
- **Promover a primitive**: Button, IconButton, Field/Input/Select/Textarea, SegmentedControl (B2B/B2C), Badge/Status, Section header, KeyValue (DetailField), EmptyState, Progress, Timeline, Drawer, Dialog, Toast, Tabs, DataTable.
- **Eliminar**: `MiniStat` como card, `QueueRow`, "Acesso Rápido", "Movimentações Recentes" como seção solta (vira feed na Central), selo "Em breve", cards de `DetailField`, timeline genérica de 5 estágios.

### Tables
- `<table>` semântico (bom), mas sem `caption`/`scope`, sem cabeçalho fixo, sem ordenação, sem filtros, sem busca local, sem seleção, sem ação por linha, sem densidade.
- Linhas inteiras com hover mas só o ID é clicável.
- Mobile: Pedidos, Cargas, Viagens e Entregas **estouram 390px**; em Viagens a coluna Situação simplesmente some (`mobile-shipments.png`).
- Datas sem ano/fuso consistentes ("28/09", "30/09, 23:52", "29/09/2026").

### Forms
- Novo Pedido: 439 linhas, modal de 672px com rolagem interna longa, 3 seções sequenciais; valida só no envio, com um único `role="alert"` no rodapé (sem erro por campo, sem `aria-describedby`).
- Campos de hora nativos sem formato pt-BR no Chromium ("08:00 AM").
- Rótulos em caixa-alta 11px com contraste 3,35:1.
- Não há atalhos (⌘+Enter para enviar), nem rascunho, nem "criar e criar outro".

### Filters
- Não existem em nenhuma lista. O estado da operação (atrasadas, com ocorrência, em rota) só é visível em contadores do cabeçalho, sem clique.

### Maps
- Bom: arquitetura de provedores, fallback esquemático, simulação com relógio, ETA por parada, "Fora da janela", progresso.
- Gaps: mapa só em `/mapa`; fundo esquemático quase sem referência; marcador do veículo selecionado usa a cor de ação; parada ativa sem destaque além do tamanho; sem marcador de exceção próprio, sem cluster, sem "seguir veículo", sem trecho percorrido × restante; controles de simulação sem ícones e sem próxima parada/atraso; lista de rotas no mobile empurra o mapa; o aviso de "mapa esquemático" ocupa o topo do mapa permanentemente.
- Numeração de paradas inconsistente: `CD, 1, 2…` no mapa e `1, 2, 3…` (com o CD como 1) no detalhe da viagem.

### Dialogs
- Dois modais artesanais (Novo Pedido, confirmações em Preferências): sem `role="dialog"`/`aria-modal`/título associado, Esc não fecha, sem foco preso, sem retorno de foco, clique fora fecha e perde o formulário sem aviso.

### Drawers
- Não existem. O painel de pedido é uma coluna fixa que espreme a tabela; o painel de rota no mapa é fixo.

### Notifications
- `ToastStack`: sem `aria-live`, sem tom (sucesso e erro iguais, ambos preto), sem ação ("Desfazer", "Ver viagem"), sem fechar, sem animação.
- Sem central de notificações nem badge de atenção no header.

### Empty States
- Central vazia e Mapa vazio têm um bom texto e próximo passo. Listas usam `<td>` cinza "Nenhuma … ainda." sem ação; Ocorrências e Solicitações sem orientação.

### Loading States
- Único: "Carregando operação…" em tela cheia e "Carregando mapa…". Sem skeleton por região, sem indicador de rota sendo calculada além do texto "calculando…".

### Error States
- `error.tsx` global e da viagem (bom), mas visualmente genéricos; não há erro por região (ex.: rota que falhou, geocodificação vazia) nem toast de erro distinto.

### Responsive
- Desktop/laptop: ok, mas com muito espaço morto (Ocorrências, Solicitações, Contratação ocupam ~60% da largura).
- Tablet 834px: sidebar de 288px consome 35% da tela.
- Mobile: **sem navegação**, tabelas cortadas, mapa empilhado abaixo de uma lista, controles de simulação quebram em 2 linhas por cima do mapa.

### Accessibility
| Item | Estado |
|---|---|
| Landmarks | `main`, `nav`, `header`, `aside` presentes no app; **Portal sem `main` e sem `h1`** |
| Skip link | ausente |
| Atributos ARIA | 2 por tela fora do mapa |
| Dialogs | ver acima — falha em teclado e leitor de tela |
| Foco | `focus:outline-none` + `ring-1` tangerina (3,11:1) nos inputs; botões com outline nativo, sem estilo consistente |
| Toasts | não anunciados |
| Contraste | todos os badges de status, alertas de atenção, links de ação e textos secundários falham (ver Color) |
| Estado só por cor | badges e severidade sem ícone |
| Formulários | input do Portal sem rótulo; erros não associados a campos |

### Motion
- Inexistente fora do mapa. Sem tokens, sem `prefers-reduced-motion`, sem transição de rota, sem feedback de mudança de status.

---

## 3. Padrões repetidos (base para primitives)

| Padrão | Ocorrências | Vira |
|---|---|---|
| Título de seção em caixa-alta | 18 | `SectionHeader` |
| Lista/tabela com borda em card branco | 26 | `List` / `DataTable` (sem card) |
| Rótulo + valor | 3 implementações | `KeyValue` |
| Input/select com a mesma classe | 4 arquivos | `Field` + `Input`/`Select`/`Textarea` |
| Botão primário tangerina | 19 | `Button` (variantes) |
| Pílula colorida de status | 3 mapas de estilo diferentes | `Status` (ícone + cor + texto, por entidade) |
| Texto de vazio ("Nenhum…") | 21 | `EmptyState` |
| Modal de confirmação | 2 | `Dialog` / `ConfirmDialog` |

## 4. Estados catalogados por componente (hoje)

| Componente | default | hover | active | focus | disabled | loading | selected | error |
|---|---|---|---|---|---|---|---|---|
| Botão primário | ✔ | ✔ | — | nativo | parcial | 1 caso (`aria-busy`) | — | — |
| Input/Select | ✔ | — | — | ring 1px (3,1:1) | — | — | — | — |
| Linha de tabela | ✔ | ✔ | — | — | — | — | painel de pedido | — |
| Item de lista do mapa | ✔ | ✔ | — | nativo | — | "calculando…" | ✔ | — |
| Badge | ✔ | — | — | — | — | — | — | — |
| Toast | ✔ | — | — | — | — | — | — | igual ao sucesso |
| Modal | ✔ | — | — | sem trap | — | — | — | 1 alerta global |
