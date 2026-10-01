# Fase 2 — Achados funcionais

Registrados durante a reconstrução da experiência. Regra da fase: corrigir só
o que bloqueia a experiência ou causaria regressão; o resto fica registrado.

| # | Achado | Onde | Decisão |
|---|---|---|---|
| F1 | `DemoTrackingProvider.dispose()` no cleanup de efeito remove a assinatura do relógio criada no construtor; em React StrictMode (dev) o efeito monta duas vezes e a simulação para de mover os veículos. Em produção não ocorria. | `components/live/LiveOperation.tsx` (antes `MapWorkspace`) | **Corrigido na UI**: o cleanup pausa o relógio em vez de descartar o provedor. Motor e provedor intocados. |
| F2 | A simulação continua avançando uma viagem com ocorrência aberta (status `Exception`) até a última parada; o domínio, corretamente, não conclui a viagem. A interface mostra "paradas atendidas" pela simulação e o status de domínio "Com ocorrência" lado a lado. | `lib/geo/simulation/engine.ts` | **Registrado**. Pausar a simulação por ocorrência é decisão de produto para a fase de rastreamento real. |
| F3 | O `ToastStack` original anunciava sucesso e erro da mesma forma e sem `aria-live`; o `NewOrderModal` mostra o erro de domínio no formulário e o provedor também dispara toast de erro (duas mensagens). | `OperationProvider` | Toast agora com tom e região `alert` para erro. A duplicidade some quando o Novo Pedido for refeito com erro por campo (etapa de planejamento). |
