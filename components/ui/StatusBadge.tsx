const STATUS_STYLES: Record<string, string> = {
  // Pedidos
  "Aguardando planejamento": "bg-cosmic-ink/8 text-cosmic-ink/70",
  "Planejado": "bg-blue-opal/10 text-blue-opal",
  "Em transporte": "bg-suez-canal/15 text-suez-canal",
  "Entregue": "bg-emerald-600/10 text-emerald-700",
  "Com ocorrência": "bg-cinnamon/15 text-cinnamon",
  // Cargas
  "Em consolidação": "bg-cosmic-ink/8 text-cosmic-ink/70",
  "Aguardando transporte": "bg-rowdy-orange/15 text-rowdy-orange",
  "Contratada": "bg-blue-opal/10 text-blue-opal",
  "Em viagem": "bg-suez-canal/15 text-suez-canal",
  "Concluída": "bg-emerald-600/10 text-emerald-700",
  // Viagens (valores internos em inglês — texto exibido é traduzido abaixo)
  "Planned": "bg-cosmic-ink/8 text-cosmic-ink/70",
  "Awaiting Pickup": "bg-rowdy-orange/15 text-rowdy-orange",
  "Pickup Completed": "bg-blue-opal/10 text-blue-opal",
  "In Transit": "bg-suez-canal/15 text-suez-canal",
  "At Delivery": "bg-suez-canal/15 text-suez-canal",
  "Delivered": "bg-emerald-600/10 text-emerald-700",
  "Closed": "bg-cosmic-ink/8 text-cosmic-ink/70",
  "Exception": "bg-cinnamon/15 text-cinnamon",
};

// Rótulos exibidos em português — os status de viagem (Shipment) usam valores
// internos em inglês por herdarem o domínio original do TMS; aqui traduzimos
// apenas a apresentação, sem alterar a lógica do reducer.
const STATUS_LABELS: Record<string, string> = {
  "Planned": "Planejada",
  "Awaiting Pickup": "Aguardando Coleta",
  "Pickup Completed": "Coleta Realizada",
  "In Transit": "Em Trânsito",
  "At Delivery": "Em Entrega",
  "Delivered": "Entregue",
  "Closed": "Encerrada",
  "Exception": "Em Exceção",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-cosmic-ink/8 text-cosmic-ink/70";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${style}`}
    >
      {statusLabel(status)}
    </span>
  );
}
