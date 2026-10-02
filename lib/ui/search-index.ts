import type { OperationDataset } from "@/lib/domain/types";
import { statusSpec } from "./status";

// Índice de busca do Command Menu. Puro: recebe o dataset, devolve entradas
// navegáveis. Cada entrada aponta para o contexto onde se age sobre ela.

export type SearchKind = "viagem" | "pedido" | "carga" | "veiculo" | "motorista" | "cliente" | "ocorrencia" | "transportadora" | "solicitacao";

export interface SearchEntry {
  key: string;
  kind: SearchKind;
  label: string;
  sublabel?: string;
  href: string;
  /** Texto usado no filtro (IDs, placas, nomes, cidades). */
  terms: string;
}

export const KIND_LABEL: Record<SearchKind, string> = {
  viagem: "Viagens",
  pedido: "Pedidos",
  carga: "Cargas",
  veiculo: "Veículos",
  motorista: "Motoristas",
  cliente: "Clientes",
  ocorrencia: "Ocorrências",
  transportadora: "Transportadoras",
  solicitacao: "Solicitações",
};

export function buildSearchIndex(d: OperationDataset): SearchEntry[] {
  const loc = new Map(d.locations.map((l) => [l.id, l]));
  const cust = new Map(d.customers.map((c) => [c.id, c]));
  const veh = new Map(d.vehicles.map((v) => [v.id, v]));
  const drv = new Map(d.drivers.map((x) => [x.id, x]));
  const out: SearchEntry[] = [];

  for (const s of d.shipments) {
    const o = loc.get(s.originId);
    const t = loc.get(s.destinationId);
    const v = s.vehicleId ? veh.get(s.vehicleId) : undefined;
    const dr = s.driverId ? drv.get(s.driverId) : undefined;
    out.push({
      key: `viagem:${s.id}`,
      kind: "viagem",
      label: s.routeCode ?? s.id,
      sublabel: `${s.id} · ${o?.city ?? "—"} → ${t?.city ?? "—"} · ${statusSpec("shipment", s.status).label}`,
      href: `/shipments/${s.id}`,
      terms: [s.id, s.routeCode, o?.name, t?.name, t?.city, v?.plate, v?.id, dr?.name].filter(Boolean).join(" "),
    });
  }
  for (const o of d.orders) {
    const c = cust.get(o.customerId);
    out.push({
      key: `pedido:${o.id}`,
      kind: "pedido",
      label: o.id,
      sublabel: `${c?.name ?? "—"} · ${o.status}`,
      href: `/orders?pedido=${o.id}`,
      terms: [o.id, c?.name, loc.get(o.destinationId)?.city].filter(Boolean).join(" "),
    });
  }
  for (const l of d.loads) {
    out.push({
      key: `carga:${l.id}`,
      kind: "carga",
      label: l.id,
      sublabel: `${l.orderIds.length} pedido(s) · ${l.totalWeightKg.toLocaleString("pt-BR")} kg · ${statusSpec("load", l.status).label}`,
      href: `/loads?carga=${l.id}`,
      terms: [l.id, ...l.orderIds].join(" "),
    });
  }
  for (const v of d.vehicles) {
    out.push({ key: `veiculo:${v.id}`, kind: "veiculo", label: `${v.id} · ${v.plate}`, sublabel: `${v.type} · ${v.status}`, href: `/fleet?veiculo=${v.id}`, terms: `${v.id} ${v.plate} ${v.type}` });
  }
  for (const x of d.drivers) {
    out.push({ key: `motorista:${x.id}`, kind: "motorista", label: x.name, sublabel: `CNH ${x.cnhCategory} · ${x.status}`, href: `/drivers?motorista=${x.id}`, terms: `${x.name} ${x.id}` });
  }
  for (const c of d.customers) {
    out.push({ key: `cliente:${c.id}`, kind: "cliente", label: c.name, sublabel: "Cliente", href: `/orders?q=${encodeURIComponent(c.name)}`, terms: c.name });
  }
  for (const o of d.occurrences) {
    out.push({
      key: `ocorrencia:${o.id}`,
      kind: "ocorrencia",
      label: `${o.id} · ${o.type}`,
      sublabel: `${o.shipmentId} · ${o.resolved ? "Resolvida" : `Em aberto · ${o.severity}`}`,
      href: `/occurrences?ocorrencia=${o.id}`,
      terms: `${o.id} ${o.type} ${o.shipmentId}`,
    });
  }
  for (const c of d.carriers) {
    out.push({ key: `transportadora:${c.id}`, kind: "transportadora", label: c.name, sublabel: `SLA ${c.slaPercent}% · OTIF ${c.otifPercent}%`, href: `/carriers?transportadora=${c.id}`, terms: c.name });
  }
  for (const s of d.solicitations ?? []) {
    out.push({ key: `solicitacao:${s.id}`, kind: "solicitacao", label: s.id, sublabel: s.status, href: `/orders?aba=entrada&solicitacao=${s.id}`, terms: s.id });
  }
  return out;
}

/** Filtro simples por termos (todas as palavras precisam aparecer), sem acento e sem caixa. */
export function searchEntries(index: SearchEntry[], query: string, limitPerKind = 5): SearchEntry[] {
  const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const perKind = new Map<SearchKind, number>();
  const out: SearchEntry[] = [];
  for (const e of index) {
    const hay = norm(`${e.label} ${e.terms}`);
    if (!words.every((w) => hay.includes(w))) continue;
    const n = perKind.get(e.kind) ?? 0;
    if (n >= limitPerKind) continue;
    perKind.set(e.kind, n + 1);
    out.push(e);
  }
  return out;
}
