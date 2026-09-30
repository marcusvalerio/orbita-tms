import type { MapMarker, MapPolyline } from "./types";

// Aparência dos marcadores e linhas, compartilhada pelos provedores de mapa.
// Estado nunca é comunicado só por cor: há forma (círculo/quadrado/seta) e
// rótulo (sequência da parada).

export const MAP_COLORS = {
  route: "#C2410C", // laranja-marca escurecido (contraste sobre o mapa)
  routeMuted: "#6B7280",
  routeDone: "#9CA3AF",
  origin: "#161616",
  pending: "#FFFFFF",
  arrived: "#1D4ED8",
  done: "#047857",
  exception: "#B91C1C",
  vehicle: "#161616",
} as const;

export const POLYLINE_STYLES: Record<MapPolyline["kind"], { strokeColor: string; strokeOpacity: number; strokeWeight: number; zIndex: number }> = {
  route: { strokeColor: MAP_COLORS.route, strokeOpacity: 0.95, strokeWeight: 5, zIndex: 10 },
  "route-muted": { strokeColor: MAP_COLORS.routeMuted, strokeOpacity: 0.55, strokeWeight: 3, zIndex: 5 },
  "route-done": { strokeColor: MAP_COLORS.routeDone, strokeOpacity: 0.9, strokeWeight: 5, zIndex: 11 },
};

function stateColor(m: MapMarker): { fill: string; text: string; border: string } {
  if (m.kind === "origin") return { fill: MAP_COLORS.origin, text: "#FFFFFF", border: "#FFFFFF" };
  switch (m.state) {
    case "done":
      return { fill: MAP_COLORS.done, text: "#FFFFFF", border: "#FFFFFF" };
    case "arrived":
      return { fill: MAP_COLORS.arrived, text: "#FFFFFF", border: "#FFFFFF" };
    case "exception":
      return { fill: MAP_COLORS.exception, text: "#FFFFFF", border: "#FFFFFF" };
    default:
      return { fill: MAP_COLORS.pending, text: "#161616", border: "#161616" };
  }
}

/** Elemento DOM do marcador (usado pelo Google AdvancedMarker). */
export function markerElement(m: MapMarker): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-label", m.title);
  el.dataset.markerId = m.id;
  if (m.kind === "vehicle") {
    el.innerHTML = `<svg width="30" height="30" viewBox="0 0 30 30" style="transform: rotate(${m.headingDeg ?? 0}deg); filter: drop-shadow(0 1px 2px rgba(0,0,0,.45))">
      <circle cx="15" cy="15" r="13" fill="${m.selected ? MAP_COLORS.route : MAP_COLORS.vehicle}" stroke="#fff" stroke-width="2.5"/>
      <path d="M15 7 L21 20 L15 17 L9 20 Z" fill="#fff"/></svg>`;
    return el;
  }
  const c = stateColor(m);
  const size = m.selected ? 28 : 24;
  const radius = m.kind === "origin" ? "6px" : "50%";
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:${radius};background:${c.fill};color:${c.text};border:2px solid ${c.border};display:flex;align-items:center;justify-content:center;font:600 12px/1 ui-sans-serif,system-ui,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.4)`;
  el.textContent = m.kind === "origin" ? "CD" : m.label ?? "";
  if (m.kind === "origin") el.style.fontSize = "10px";
  return el;
}
