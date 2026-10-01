import type { OperationDataset, Occurrence } from "@/lib/domain/types";
import type { VehiclePosition } from "@/lib/geo/types";
import { readTrip, hhmm, windowLabel, isFinished, type TripReading, type TripStop } from "./trip";

// ATTENTION SCORE
// ---------------
// Índice DETERMINÍSTICO e EXPLICÁVEL de quanto um item precisa da atenção do
// operador agora. Não é previsão, IA nem modelo estatístico: é a soma de
// regras fixas sobre dados que já existem, e cada ponto vem com o motivo.
//
//   Regra                                         Pontos
//   ETA excede a janela de uma parada              40 + 1 por min (máx. +25)
//   Folga até o fim da janela ≤ 15 min             25
//   Ocorrência aberta  Crítica / Média / Baixa     40 / 25 / 12
//   Paradas adicionais atrasadas                   +5 cada (máx. +10)
//   Saída prevista passou e a viagem não iniciou   20 + 1 por 5 min (máx. +15)
//   Prioridade do pedido  Urgente / Alta           10 / 5
//
//   Nível: crítica (ocorrência crítica ou ≥ 80) · alta (≥ 55) · média (≥ 30) · baixa
//
// Itens só entram na fila quando há ao menos um motivo.

export type AttentionLevel = "critica" | "alta" | "media" | "baixa";
export type AttentionAction = "ver-rota" | "resolver" | "registrar-atraso" | "iniciar" | "abrir";

export interface AttentionReason {
  code: "late" | "risk" | "occurrence" | "more-late" | "not-started" | "priority";
  text: string;
  points: number;
}

export interface AttentionItem {
  key: string;
  shipmentId: string;
  title: string;
  /** Parada ou objeto que concentra o problema. */
  subject: string;
  stopIndex: number | null;
  window: string | null;
  eta: string | null;
  score: number;
  level: AttentionLevel;
  reasons: AttentionReason[];
  /** Frase principal: por que este item está aqui. */
  headline: string;
  actions: AttentionAction[];
  occurrence?: Occurrence;
  trip: TripReading;
}

const OCC_POINTS = { Crítica: 40, Média: 25, Baixa: 12 } as const;

export function levelFor(score: number, criticalOccurrence: boolean): AttentionLevel {
  if (criticalOccurrence || score >= 80) return "critica";
  if (score >= 55) return "alta";
  if (score >= 30) return "media";
  return "baixa";
}

export function attentionFor(data: OperationDataset, trip: TripReading, nowMs: number): AttentionItem | null {
  const s = trip.shipment;
  if (isFinished(s)) return null;
  const reasons: AttentionReason[] = [];
  const open = trip.stops.filter((st) => st.state !== "done");
  const late = open.filter((st) => st.delayMin > 0);
  const risky = open.filter((st) => st.state === "risk");
  const focus: TripStop | undefined = late[0] ?? risky[0] ?? open[0];

  if (late.length) {
    const first = late[0];
    reasons.push({
      code: "late",
      text: `ETA ${hhmm(first.eta)} excede a janela ${windowLabel(first)} em ${first.delayMin} min.`,
      points: 40 + Math.min(25, first.delayMin),
    });
    if (late.length > 1) reasons.push({ code: "more-late", text: `Mais ${late.length - 1} parada(s) projetada(s) fora da janela.`, points: Math.min(10, (late.length - 1) * 5) });
  } else if (risky.length) {
    const first = risky[0];
    reasons.push({ code: "risk", text: `Folga de ${first.slackMin} min até o fim da janela ${windowLabel(first)} (ETA ${hhmm(first.eta)}).`, points: 25 });
  }

  const occurrences = data.occurrences.filter((o) => trip.openOccurrenceIds.includes(o.id));
  const worst = occurrences.sort((a, b) => OCC_POINTS[b.severity] - OCC_POINTS[a.severity])[0];
  if (worst) {
    const minutesOpen = Math.max(0, Math.round((nowMs - new Date(worst.reportedAt).getTime()) / 60000));
    reasons.push({
      code: "occurrence",
      text: `Ocorrência ${worst.type.toLowerCase()} (${worst.severity.toLowerCase()}) aberta${minutesOpen ? ` há ${minutesOpen} min` : ""} — viagem bloqueada até resolver.`,
      points: OCC_POINTS[worst.severity],
    });
  }

  if (s.status === "Planned" && new Date(s.departureTime).getTime() < nowMs) {
    const lateBy = Math.round((nowMs - new Date(s.departureTime).getTime()) / 60000);
    reasons.push({ code: "not-started", text: `Saída prevista às ${hhmm(s.departureTime)} e a viagem não foi iniciada (${lateBy} min).`, points: 20 + Math.min(15, Math.floor(lateBy / 5)) });
  }

  if (reasons.length === 0) return null;

  const orders = data.orders.filter((o) => (focus?.orderIds.length ? focus.orderIds : data.loads.find((l) => l.id === s.loadId)?.orderIds ?? []).includes(o.id));
  const priority = orders.some((o) => o.priority === "Urgente") ? "Urgente" : orders.some((o) => o.priority === "Alta") ? "Alta" : null;
  if (priority) reasons.push({ code: "priority", text: `Pedido com prioridade ${priority.toLowerCase()}.`, points: priority === "Urgente" ? 10 : 5 });

  const score = Math.min(100, reasons.reduce((n, r) => n + r.points, 0));
  const level = levelFor(score, worst?.severity === "Crítica");
  const main = [...reasons].sort((a, b) => b.points - a.points)[0];

  const actions: AttentionAction[] = [];
  if (worst) actions.push("resolver");
  else if (s.status === "Planned") actions.push("iniciar");
  else if (late.length) actions.push("registrar-atraso");
  actions.push("ver-rota");

  return {
    key: `trip:${s.id}`,
    shipmentId: s.id,
    title: s.routeCode ?? s.id,
    subject: focus ? (focus.index === 0 ? focus.name : `Parada ${focus.index} · ${focus.name}`) : s.id,
    stopIndex: focus?.index ?? null,
    window: focus ? windowLabel(focus) : null,
    eta: focus?.eta ?? null,
    score,
    level,
    reasons,
    headline: main.text,
    actions: actions.slice(0, 2),
    occurrence: worst,
    trip,
  };
}

/** Fila "Agora": todas as viagens com motivo, da maior para a menor atenção. */
export function attentionQueue(
  data: OperationDataset,
  positions: Map<string, VehiclePosition>,
  nowMs: number
): { items: AttentionItem[]; trips: Map<string, TripReading> } {
  const trips = new Map<string, TripReading>();
  const items: AttentionItem[] = [];
  for (const s of data.shipments) {
    const trip = readTrip(data, s, positions.get(s.id) ?? null);
    trips.set(s.id, trip);
    const item = attentionFor(data, trip, nowMs);
    if (item) items.push(item);
  }
  items.sort((a, b) => b.score - a.score || a.shipmentId.localeCompare(b.shipmentId));
  return { items, trips };
}
