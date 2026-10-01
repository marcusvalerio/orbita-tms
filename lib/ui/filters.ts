import type { StatusTone } from "./status";
import type { TripReading } from "./trip";

// Filtros operacionais de viagem — os mesmos no Command Center, no Mapa e na
// lista de Viagens. Valor na URL (?filtro=…); mapa, fila e tabela leem o mesmo.

export type TripFilter = "todas" | "em-rota" | "no-prazo" | "em-risco" | "atrasadas" | "ocorrencia" | "planejadas";

export const TRIP_FILTERS: { value: TripFilter; label: string; tone: StatusTone | "all"; test: (t: TripReading) => boolean }[] = [
  { value: "todas", label: "Todas", tone: "all", test: () => true },
  { value: "em-rota", label: "Em rota", tone: "info", test: (t) => t.tracked },
  { value: "no-prazo", label: "No prazo", tone: "success", test: (t) => t.health === "ok" },
  { value: "em-risco", label: "Em risco", tone: "warning", test: (t) => t.health === "risk" },
  { value: "atrasadas", label: "Atrasadas", tone: "danger", test: (t) => t.health === "late" || (t.health === "exception" && t.maxDelayMin > 0) },
  { value: "ocorrencia", label: "Com ocorrência", tone: "exception", test: (t) => t.health === "exception" },
  { value: "planejadas", label: "Planejadas", tone: "neutral", test: (t) => t.health === "idle" },
];

export function parseTripFilter(v: string | null): TripFilter {
  return (TRIP_FILTERS.find((f) => f.value === v)?.value ?? "todas") as TripFilter;
}

export function filterTrips(trips: TripReading[], filter: TripFilter): TripReading[] {
  const f = TRIP_FILTERS.find((x) => x.value === filter)!;
  return trips.filter(f.test);
}

export function tripFilterOptions(trips: TripReading[]) {
  return TRIP_FILTERS.map((f) => ({ value: f.value, label: f.label, tone: f.tone, count: trips.filter(f.test).length }));
}
