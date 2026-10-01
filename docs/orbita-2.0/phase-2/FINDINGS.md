# Fase 2 — Achados funcionais

Registrados durante a reconstrução da experiência. Regra da fase: corrigir só
o que bloqueia a experiência ou causaria regressão; o resto fica registrado.

| # | Achado | Onde | Decisão |
|---|---|---|---|
| F1 | `DemoTrackingProvider.dispose()` no cleanup de efeito remove a assinatura do relógio criada no construtor; em React StrictMode (dev) o efeito monta duas vezes e a simulação para de mover os veículos. Em produção não ocorria. | `components/live/LiveOperation.tsx` (antes `MapWorkspace`) | **Corrigido na UI**: o cleanup pausa o relógio em vez de descartar o provedor. Motor e provedor intocados. |
| F2 | A simulação continua avançando uma viagem com ocorrência aberta (status `Exception`) até a última parada; o domínio, corretamente, não conclui a viagem. A interface mostra "paradas atendidas" pela simulação e o status de domínio "Com ocorrência" lado a lado. | `lib/geo/simulation/engine.ts` | **Registrado**. Pausar a simulação por ocorrência é decisão de produto para a fase de rastreamento real. |
| F3 | O `ToastStack` original anunciava sucesso e erro da mesma forma e sem `aria-live`; o `NewOrderModal` mostra o erro de domínio no formulário e o provedor também dispara toast de erro (duas mensagens). | `OperationProvider` | Toast agora com tom e região `alert` para erro. **Duplicidade continua registrada**: o `NewOrderDialog` mostra o erro de domínio no lugar (`role=alert`) e o provedor ainda dispara o toast. Resolver exige uma opção "silenciosa" no `dispatch` do provedor — fica para quando a camada de comandos for revisitada. |
| F4 | Barras e tabelas dimensionadas pela largura da **janela** quebravam dentro de painéis estreitos (Mapa a 1440px: barra de simulação cortada; Viagens/Cargas a 834px: coluna Situação/ação cortada). | `SimulationBar`, `ShipmentsWorkspace`, `LoadsWorkspace` | **Corrigido**: a barra usa container query (largura do mapa); colunas secundárias saem abaixo de `lg`. Pego pela QA visual final. |
| F5 | axe-core (WCAG 2.1 AA) apontou: SVG do mapa com `role=img` contendo marcadores interativos; ponto concluído da timeline (branco sobre verde-600, 3,9:1); `dt/dd` fora de `dl`; abas sem painel com `aria-controls` órfão. | `map-provider`, `Data.tsx`, `Form.tsx` | **Corrigido**; `tests/e2e/a11y.spec.ts` impede regressão. |
