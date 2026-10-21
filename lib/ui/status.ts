// Arquitetura de status do ÓRBITA: todo estado é ÍCONE + TEXTO + COR.
// A cor reforça; o ícone e o texto carregam o significado (WCAG 1.4.1).
// Uma única tabela por entidade — usada em badges, tabelas, mapa e timeline.

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "critical" | "exception";

/**
 * Glifos do sistema de status (mapeados para ícones em components/ds/Status):
 *   moving  ●  em movimento / em rota          done     ✓  concluído
 *   waiting ◷  aguardando                      risk     !  em risco / atenção
 *   idle    ○  parado / pendente / disponível  failed   ×  falhou / cancelado / recusado
 *   planned ◉  planejado / contratado          critical ⬣  crítico
 *   issue   ◆  com ocorrência / exceção        returned ↩  devolvido
 *   inbox   ▣  recebido                        blocked  ⊘  indisponível / manutenção
 */
export type StatusGlyph =
  | "moving"
  | "done"
  | "waiting"
  | "risk"
  | "idle"
  | "failed"
  | "planned"
  | "critical"
  | "issue"
  | "returned"
  | "inbox"
  | "blocked";

export interface StatusSpec {
  label: string;
  tone: StatusTone;
  glyph: StatusGlyph;
}

export type StatusEntity =
  | "shipment"
  | "order"
  | "load"
  | "delivery"
  | "occurrence"
  | "severity"
  | "solicitation"
  | "vehicle"
  | "driver"
  | "stop"
  | "attention";

const s = (label: string, tone: StatusTone, glyph: StatusGlyph): StatusSpec => ({ label, tone, glyph });

export const STATUS: Record<StatusEntity, Record<string, StatusSpec>> = {
  shipment: {
    Planned: s("Planejada", "neutral", "planned"),
    "Awaiting Pickup": s("Aguardando coleta", "neutral", "waiting"),
    "Pickup Completed": s("Coleta realizada", "info", "moving"),
    "In Transit": s("Em rota", "info", "moving"),
    "At Delivery": s("Na entrega", "info", "moving"),
    Delivered: s("Entregue", "success", "done"),
    Closed: s("Encerrada", "neutral", "done"),
    Exception: s("Com ocorrência", "exception", "issue"),
  },
  order: {
    "Aguardando planejamento": s("Aguardando planejamento", "neutral", "waiting"),
    Planejado: s("Planejado", "neutral", "planned"),
    "Em transporte": s("Em transporte", "info", "moving"),
    Entregue: s("Entregue", "success", "done"),
    "Com ocorrência": s("Com ocorrência", "exception", "issue"),
    Devolvido: s("Devolvido", "danger", "returned"),
  },
  load: {
    "Em consolidação": s("Em consolidação", "neutral", "waiting"),
    "Aguardando transporte": s("Aguardando contratação", "warning", "risk"),
    Contratada: s("Contratada", "neutral", "planned"),
    "Em viagem": s("Em viagem", "info", "moving"),
    Concluída: s("Concluída", "success", "done"),
  },
  delivery: {
    Delivered: s("Entregue", "success", "done"),
    "Partial Delivery": s("Entrega parcial", "warning", "risk"),
    Failed: s("Não realizada", "danger", "failed"),
    Returned: s("Devolvida", "danger", "returned"),
    Pending: s("A caminho", "info", "moving"),
    Late: s("Atrasada", "danger", "risk"),
    AtRisk: s("Em risco", "warning", "risk"),
    Scheduled: s("Programada", "neutral", "idle"),
    Served: s("Atendida", "success", "done"),
  },
  occurrence: {
    open: s("Em aberto", "exception", "issue"),
    resolved: s("Resolvida", "success", "done"),
  },
  severity: {
    Baixa: s("Baixa", "neutral", "idle"),
    Média: s("Média", "warning", "risk"),
    Crítica: s("Crítica", "critical", "critical"),
  },
  solicitation: {
    Solicitada: s("Nova", "info", "inbox"),
    "Em análise": s("Em análise", "neutral", "waiting"),
    "Convertida em Pedido": s("Convertida", "success", "done"),
    Recusada: s("Recusada", "danger", "failed"),
  },
  vehicle: {
    Disponível: s("Disponível", "neutral", "idle"),
    "Em Viagem": s("Em viagem", "info", "moving"),
    Manutenção: s("Manutenção", "warning", "blocked"),
  },
  driver: {
    Disponível: s("Disponível", "neutral", "idle"),
    "Em Viagem": s("Em viagem", "info", "moving"),
    Folga: s("Folga", "neutral", "blocked"),
  },
  stop: {
    Pendente: s("Pendente", "neutral", "idle"),
    "Em rota": s("Próxima", "info", "moving"),
    Chegou: s("No local", "info", "moving"),
    "Em descarga": s("Em descarga", "info", "moving"),
    Entregue: s("Concluída", "success", "done"),
    Atrasada: s("Atrasada", "danger", "risk"),
    "Em risco": s("Em risco", "warning", "risk"),
    Ocorrência: s("Com ocorrência", "exception", "issue"),
  },
  attention: {
    alta: s("Atenção alta", "danger", "risk"),
    media: s("Atenção média", "warning", "risk"),
    baixa: s("Acompanhar", "neutral", "idle"),
    critica: s("Atenção crítica", "critical", "critical"),
  },
};

export function statusSpec(entity: StatusEntity, value: string): StatusSpec {
  return STATUS[entity][value] ?? s(value, "neutral", "idle");
}
