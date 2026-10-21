# Fase 2 — Órbita Design System 2.0

Reconstrução da camada de experiência do ÓRBITA em torno de um **Transportation Command Center**: o mapa é o espaço operacional, a fila "Agora" diz o que pede atenção e por quê, e toda ação está a no máximo um passo de quem está vendo o problema.

A arquitetura funcional da Fase 1 não mudou: domínio, reducer, camada de aplicação, repositórios, Neon PostgreSQL + Neon Auth, RBAC, Modo Demo/Produção, abstração geo (MapProvider, RouteProvider, TrackingProvider) e motor de simulação. As mudanças em `lib/geo` são aditivas (tipos de marcador, `panTo`/`zoomBy`, estilo de mapa).

## Documentos

| Documento | Conteúdo |
|---|---|
| [GAP-REPORT.md](GAP-REPORT.md) | auditoria visual inicial (19 dimensões) · capturas em `audit/` |
| [REFERENCES.md](REFERENCES.md) | análise das 5 referências e os 14 princípios derivados |
| [PLAN.md](PLAN.md) | tokens, arquitetura de informação, conceito do Command Center, sequência de commits |
| [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) | camadas, cor, tipografia, forma, inventário de componentes e patterns, acessibilidade |
| [MOTION.md](MOTION.md) | tokens e padrões de movimento, mapa, movimento reduzido |
| [FINDINGS.md](FINDINGS.md) | achados funcionais (corrigidos ou registrados) |
| `qa/final/` | QA visual final: 14 telas × 4 viewports (desktop 1440, laptop 1280, tablet 834, mobile 390) |

Catálogo vivo: **`/design-system`**.

## O que foi entregue

- **Tokens** (`app/globals.css`, espelho em `lib/design/tokens.ts`): primitivos → semânticos → utilitários Tailwind; ação (Charcoal) ≠ seleção (Tangerine) ≠ estado; tema claro, mapa claro dessaturado; tokens escuros preparados e inativos.
- **Primitives e componentes** (`components/ds`) com todos os estados; status sempre ícone + texto + cor a partir de uma tabela única (`lib/ui/status.ts`).
- **App shell**: sidebar recolhível, header com breadcrumb, ⌘K (Command Menu com busca de entidades, ações da tela, filtros prontos), notificações, "Novo"; no mobile, bottom nav com 5 destinos + sheet "Mais".
- **Navegação**: Operação (Command Center, Mapa, Viagens, Entregas, Ocorrências) · Planejamento (Pedidos com Caixa de entrada, Planejamento, Cargas com contratação no contexto) · Recursos (Frota, Motoristas, Transportadoras, Parceiros) · Configuração. `/solicitacoes` e `/contratacao` redirecionam; nenhuma função sumiu. Análise e Acesso fora da navegação; KPIs na faixa do Command Center.
- **Command Center**: mapa + filtros com contagem (URL ↔ mapa ↔ fila ↔ tabela) + fila "Agora" ordenada pelo **Attention Score** — determinístico, soma de regras explícitas (atraso projetado, folga da janela, ocorrência e severidade, saída atrasada, prioridade), cada item com o motivo escrito; nunca chamado de IA ou previsão.
- **Mapa operacional**: rota feita × restante, estados das paradas, veículo com direção interpolada, seguir veículo, enquadrar, legenda, rótulos sem colisão, simulação com velocidades e atalho de teclado.
- **Viagem, Entregas, Ocorrências, Pedidos, Planejamento, Cargas, Frota, Motoristas, Transportadoras, Parceiros, Preferências, Portal do parceiro, login** refeitos no DS. Recursos com ações estruturadas para o futuro (atribuir, iniciar, disponibilidade, histórico, viagens, ocorrências) sem novas regras de negócio.
- **Motion** próprio, nativo (CSS, WAAPI, `<ViewTransition>`), sem biblioteca.

## Validação

Executada no fim de cada etapa e, por último, sobre o commit final.

| Verificação | Comando | Resultado |
|---|---|---|
| Lint | `npm run lint` | limpo |
| Tipos | `npm run typecheck` | limpo |
| Unitários (domínio, aplicação, geo, UI, contraste, disciplina do DS) | `npm test` | **210/210** |
| Build | `npm run build` | ok |
| E2E Modo Demo — fluxo ponta a ponta, mapa, simulação | `npx playwright test` | 7/7 |
| E2E experiência — ⌘K, filtro na URL + resolver pela fila, redirects, Caixa de entrada → pedido, contratação com frota própria, resolução rápida, bottom nav mobile | `tests/e2e/experience.spec.ts` | 7/7 |
| Acessibilidade — axe WCAG 2.1 A/AA em 16 telas, overlays (⌘K, Novo pedido, drawers), mobile, login, portal | `tests/e2e/a11y.spec.ts` | 19/19, zero *serious/critical* |
| Regressão visual — 8 baselines (desktop + mobile), relógio congelado | `tests/e2e/visual.spec.ts` | 8/8 |
| E2E Modo Produção — PostgreSQL real, sessão, RBAC, auditoria, isolamento do parceiro | `E2E_DATABASE_URL=… npx playwright test` | **8/8** (PostgreSQL 16 local) |
| QA visual — 4 viewports, sem overflow horizontal | `node scripts/visual-qa.mjs` | ok · `qa/final/` |

Total E2E: **49/49**. O CI (`.github/workflows/ci.yml`) já roda todos: o projeto `demo` inclui experiência, a11y e visual.

Baselines visuais: geradas com o Chromium 1194 (o mesmo que o Playwright 1.56 instala no CI) e fontes servidas pelo próprio app. Se o runner renderizar diferente, atualizar com `npx playwright test visual --update-snapshots=all` no mesmo ambiente.

## Decisões

1. **Mapa no centro, não um card.** A Central é o mapa com a fila ao lado; KPIs numa faixa fina, sem painel de gráficos.
2. **Explicar antes de pontuar.** O número do Attention Score só aparece junto do motivo; a regra está em `lib/ui/attention.ts` e testada.
3. **Duas ações visíveis, o resto no ⋯ e no ⌘K.** Em painéis estreitos, rótulo curto visível e nome acessível completo.
4. **URL como fonte do estado de filtro e seleção.** Recarregar, compartilhar e voltar funcionam.
5. **Mobile próprio.** Bottom nav + sheets; tabelas viram lista; nenhuma tela com rolagem horizontal da página.
6. **Sem abstração prematura.** Componente entra em `components/ds` só quando serve a mais de uma tela.
