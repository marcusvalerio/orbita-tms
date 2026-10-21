# Órbita Design System 2.0

Fonte da verdade: `app/globals.css` (tokens) · `components/ds/*` (primitives e componentes) · `/design-system` (catálogo vivo).
Contraste: `lib/design/contrast.test.ts` mede todos os pares usados e roda no `npm test`.

## Camadas

```
tokens (app/globals.css)         --p-* primitivos → --orb-* semânticos → utilitários Tailwind
primitives (components/ds)       Button, IconButton, Input, Select, Field, Tabs, Tooltip, Popover, Menu, Dialog, Drawer…
components (components/ds)       Status, FilterChip, DataTable, EntityRow, MetricGrid, TripProgress, Timeline, AttentionItem…
patterns (components/patterns)   blocos de domínio reutilizados entre telas (painel da viagem, fila de atenção, cabeçalho de workspace)
layouts (components/shell)       AppShell, Sidebar, Header, BottomNav, CommandMenu, Workspace
páginas (app/(ops)/*)            composição; componentes específicos ficam no arquivo da tela
```

Regra: um componente só entra em `ds/` quando é usado (ou claramente será) em mais de uma tela. Específico da tela fica na tela.

## Cor

| Papel | Utilitário | Uso |
|---|---|---|
| canvas / surface / surface-sunken / surface-hover / surface-selected | `bg-canvas` … | fundo do workspace, regiões de dados, linhas |
| chrome | `bg-chrome` | sidebar |
| fg / fg-muted / fg-subtle / fg-disabled / fg-inverse | `text-fg` … | texto (todos ≥ 4,5:1 nas superfícies onde são usados) |
| line-subtle / line / line-strong | `border-line` … | separadores, controles, ênfase |
| **primary** (Charcoal) | `bg-primary text-primary-fg` | **ação**. Nunca estado |
| **brand** (Tangerine) | `bg-brand`, `text-brand-fg` | marca e **seleção**. Nunca estado |
| neutral · info · success · warning · danger · exception | `text-{s}-fg bg-{s}-subtle border-{s}-line`, `text-{s}` (ícone) | **estado**, sempre com ícone + texto |
| **critical** | `bg-critical text-critical-fg` | estado mais grave — sólido |
| route / route-muted / route-done / vehicle / delivery | — | domínio (mapa, timeline) |

Ação ≠ crítico: `primary` (#161616) e `brand` (#FF5B19) nunca coincidem com `danger`/`critical`/`warning`/`exception` (testado).

## Tipografia

| Token | px / linha · peso | Fonte | Uso |
|---|---|---|---|
| `text-display` | 28/36 · 600 | Sora | número-herói |
| `text-h1` | 20/28 · 600 | Sora (`font-display`) | título de workspace |
| `text-h2` | 15/22 · 600 | Inter | título de seção/painel |
| `text-h3` | 13/20 · 600 | Inter | subtítulo, grupo |
| `text-body` | 14/20 | Inter | padrão |
| `text-body-sm` | 13/18 | Inter | tabela compacta, meta |
| `text-label` | 12/16 · 500 | Inter | rótulo, cabeçalho de tabela |
| `text-caption` | 12/16 | Inter | auxiliar |
| `.orb-data` | herda | Geist Mono, tabular | **dado operacional**: VIA-00004, RJT3P27, RJ-ZONA-OESTE-042, 01:52, 64,3 km |
| `.tabular` | herda | Inter tabular | contagens, %, moeda |

Mínimo absoluto 12px. Títulos em sentence case; caixa-alta só em siglas.

## Espaço, forma, elevação

- Espaço: escala Tailwind de 4px. Padrões: gutter 24px (desktop) / 16px (mobile); célula 12px horizontal; linha compacta 36px, padrão 44px; gap de grupo 8px, de seção 24px.
- Radius: `rounded-xs` 2 (badge interno) · `rounded-sm` 4 (botão, input, chip) · `rounded-md` 6 (menu, popover, tooltip) · `rounded-lg` 10 (dialog, drawer flutuante, painel sobre o mapa, sheet) · `rounded-full` (ponto, avatar). Regiões de dados: 0.
- Bordas: sempre 1px; `line-subtle` entre linhas, `line` em controles, `line-strong` para ênfase.
- Elevação: `shadow-1` (sticky) · `shadow-2` (drawer, painel sobre mapa) · `shadow-3` (dialog, ⌘K, popover, toast). Sem sombra no workspace.
- Layout: sidebar 232/56px · header 48px · drawer 440px · bottom nav 60px.

## Inventário

### Primitives — `components/ds`

| Componente | Arquivo | Estados / notas |
|---|---|---|
| `Button` | Button.tsx | primary · secondary · ghost · danger · brand-ghost; sm/md/lg; `loading` (aria-busy, mantém foco), `selected` (aria-pressed), `asChild`, `iconOnly` |
| `IconButton` | Button.tsx | rótulo obrigatório (tooltip + nome acessível), atalho, badge |
| `Tooltip` · `Popover` · `Menu` | Overlay.tsx | Radix; `Menu` aceita itens e `"separator"`; ⋯ é o lugar das ações além das 2 principais |
| `Dialog` · `ConfirmDialog` · `Drawer` | Overlay.tsx | foco no conteúdo ao abrir; Drawer lateral (≥768px) ou sheet (mobile), largura por `--orb-drawer-w` |
| `Field` · `Input` · `Textarea` · `Select` · `DateInput` · `SearchInput` · `Checkbox` | Form.tsx | `Field` liga rótulo, dica e erro (`aria-describedby`, `aria-invalid`) |
| `Combobox` | Form.tsx | cmdk em Popover |
| `SegmentedControl` · `Tabs`/`TabPanel` | Form.tsx | Tabs sem painel (visões) não apontam `aria-controls` |
| `Spinner` · `Skeleton` · `SkeletonRows` · `EmptyState` · `ErrorState` · `LoadingState` · `Toaster` | Feedback.tsx | toast `polite` (sucesso/info) e `assertive` (erro), com ação |

### Componentes — `components/ds`

| Componente | Uso |
|---|---|
| `Status` · `StatusDot` · `StatusGlyphIcon` | **ícone + texto + cor** a partir de `lib/ui/status.ts` (uma tabela por entidade); pisca uma vez quando o valor muda |
| `FilterBar` / `FilterChip` | radiogroup com contagem; estado na URL (`useUrlParam`) — mapa, fila e tabela leem o mesmo filtro |
| `DataTable` | ordenação, seleção, linha ativa, cabeçalho fixo, paginação, teclado, `rowActions`, densidade, `hideBelow` por coluna, cartão no mobile, linhas novas com `.orb-enter` |
| `KeyValue` · `MetricGrid` · `Kpi` · `Progress` | dados densos; `KeyValue` dentro de `<dl>` |
| `TripProgress` · `Timeline` | paradas por estado (concluída, próxima, atrasada, em risco, ocorrência) |
| `AttentionMeter` | nunca sozinho: sempre ao lado do motivo em texto |
| `DistributionBar` · `HeatStrip` | micrográficos com equivalente textual (`role=img` + rótulo, tabela sr-only) |
| `SectionHeader` · `Kbd` · `EntityRow` | estrutura |

### Patterns — `components/patterns`

| Pattern | Telas |
|---|---|
| `useTripActions` (ações + diálogos de ocorrência/resolução) | Central, Mapa, Viagem, fila "Agora" |
| `TripPanel` | drawer da Central, painel do Mapa |
| `AttentionCard` | fila "Agora" — motivo explícito, até 2 ações, resto no ⋯ |
| `NewOrderDialog` | header ("Novo"), ⌘K, Pedidos |
| `TenderPanel` | Cargas (contratação no contexto da carga) |
| `ResourceActions` · `ResourceTrips` | Frota, Motoristas, Transportadoras |

### Layouts — `components/shell`

`AppShell` (providers, skip link, transição de página) · `Sidebar` 232/56px · `Header` (breadcrumb, ⌘K, notificações, "Novo", perfil) · `BottomNav` (Central · Mapa · Viagens · Ocorrências · Mais) · `CommandMenu` (⌘K ou `/`: nesta tela, recentes, busca de entidades, criar, filtros prontos, ir para).

### Derivações puras — `lib/ui`

`readTrip` (estado de cada parada: ETA × janela, margem de risco 15 min) · `attentionQueue` (**Attention Score determinístico** — soma de regras explícitas, cada item com motivo; não é previsão) · `deliveryQueue` · `horizon` · `TRIP_FILTERS` · `buildSearchIndex`. Testadas em `lib/ui/*.test.ts`.

## Acessibilidade

- Contraste AA medido por teste (`lib/design/contrast.test.ts`) e por axe nas telas (`tests/e2e/a11y.spec.ts`, falha em *serious/critical*).
- Status nunca só por cor (ícone + texto). Foco visível 2px em tudo; skip link; `aria-live` na fila e nos toasts.
- Mapa: grupo rotulado; marcadores são botões com nome; o painel lateral repete tudo o que o mapa mostra.
- Movimento reduzido respeitado (ver Motion).

## Motion

Ver [MOTION.md](MOTION.md).

## Tema escuro

Preparado em `:root[data-theme="dark"]` (só semânticos). Não ativado nesta fase.
