import type { MapMarker, MapPolyline } from "./types";
import { COLOR } from "../design/tokens";

// Linguagem visual do mapa ÓRBITA 2.0, compartilhada pelos provedores
// (esquemático em SVG e Google Maps via AdvancedMarker). Cores vêm dos tokens
// do DS (contraste ≥ 3:1 sobre o mapa claro, testado). Estado nunca é só cor:
// forma (círculo, quadrado, losango), glifo (número, ✓, !) e anel.

export const MAP_COLORS = {
  route: COLOR.route,
  routeMuted: COLOR.routeMuted,
  routeDone: COLOR.routeDone,
  origin: COLOR.fg,
  pending: COLOR.surface,
  arrived: COLOR.info,
  done: COLOR.success,
  exception: COLOR.exception,
  late: COLOR.danger,
  risk: COLOR.warning,
  vehicle: COLOR.vehicle,
  brand: COLOR.brand,
  delivery: COLOR.delivery,
} as const;

export interface PolylineStyle {
  strokeColor: string;
  strokeOpacity: number;
  strokeWeight: number;
  zIndex: number;
  /** Contorno claro sob a linha (legibilidade sobre vias). */
  casing?: number;
  dashed?: boolean;
}

export const POLYLINE_STYLES: Record<MapPolyline["kind"], PolylineStyle> = {
  route: { strokeColor: MAP_COLORS.route, strokeOpacity: 1, strokeWeight: 5, zIndex: 10, casing: 9 },
  "route-muted": { strokeColor: MAP_COLORS.routeMuted, strokeOpacity: 0.75, strokeWeight: 3, zIndex: 5 },
  "route-done": { strokeColor: MAP_COLORS.routeDone, strokeOpacity: 1, strokeWeight: 5, zIndex: 11, casing: 9 },
  "route-preview": { strokeColor: MAP_COLORS.route, strokeOpacity: 0.9, strokeWeight: 3, zIndex: 12, dashed: true },
};

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Raio de colisão (px) do marcador — usado no agrupamento. */
export function markerRadius(m: MapMarker): number {
  if (m.kind === "vehicle") return 15;
  if (m.kind === "origin") return 12;
  return m.selected ? 13 : 11;
}

/**
 * Marcação SVG do marcador, centrada em (0,0). O grupo `.orb-heading` recebe a
 * rotação do veículo — os provedores atualizam só esse atributo a cada quadro.
 */
export function markerSvg(m: MapMarker): string {
  const white = COLOR.surface;
  if (m.kind === "vehicle") {
    const ring = m.state === "exception" ? MAP_COLORS.exception : m.state === "late" ? MAP_COLORS.late : white;
    return [
      m.selected ? `<circle r="24" fill="${MAP_COLORS.brand}" opacity="0.16" class="orb-marker-pulse"/>` : "",
      m.selected ? `<circle r="19" fill="none" stroke="${MAP_COLORS.brand}" stroke-width="2.5"/>` : "",
      `<circle r="14" fill="${MAP_COLORS.vehicle}" stroke="${ring}" stroke-width="${ring === white ? 2.5 : 3.5}"/>`,
      `<g class="orb-heading" transform="rotate(${Math.round(m.headingDeg ?? 0)})"><path d="M0 -8 L6.5 6.5 L0 3 L-6.5 6.5 Z" fill="${white}"/></g>`,
    ].join("");
  }
  if (m.kind === "origin") {
    return `<rect x="-13" y="-11" width="26" height="22" rx="4" fill="${MAP_COLORS.origin}" stroke="${white}" stroke-width="2"/><text text-anchor="middle" dy="3.5" font-size="10" font-weight="700" fill="${white}" font-family="ui-sans-serif,system-ui">CD</text>`;
  }
  if (m.kind === "exception") {
    return `<rect x="-10" y="-10" width="20" height="20" rx="3" transform="rotate(45)" fill="${MAP_COLORS.exception}" stroke="${white}" stroke-width="2"/><text text-anchor="middle" dy="4.5" font-size="13" font-weight="800" fill="${white}" font-family="ui-sans-serif,system-ui">!</text>`;
  }
  if (m.kind === "destination") {
    return `<circle r="11" fill="${MAP_COLORS.delivery}" stroke="${white}" stroke-width="2.5"/><text text-anchor="middle" dy="4" font-size="12" font-weight="700" fill="${white}">${esc(m.label ?? "★")}</text>`;
  }
  // Parada
  const r = m.selected ? 13 : 11;
  const label = esc(m.label ?? "");
  const text = (fill: string) => `<text text-anchor="middle" dy="4" font-size="11.5" font-weight="700" fill="${fill}" font-family="ui-sans-serif,system-ui">${label}</text>`;
  const badge = (color: string) => `<circle cx="${r - 1}" cy="${-(r - 1)}" r="6" fill="${color}" stroke="${white}" stroke-width="1.5"/><text x="${r - 1}" y="${-(r - 1)}" dy="3" text-anchor="middle" font-size="9" font-weight="800" fill="${white}">!</text>`;
  const ring = m.selected ? `<circle r="${r + 4}" fill="none" stroke="${MAP_COLORS.brand}" stroke-width="2"/>` : "";
  switch (m.state) {
    case "done":
      return `${ring}<circle r="${r}" fill="${MAP_COLORS.done}" stroke="${white}" stroke-width="2"/><path d="M-4.5 0.5 L-1.5 3.5 L4.5 -3" fill="none" stroke="${white}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "active":
      return `<circle r="${r}" fill="${MAP_COLORS.arrived}" opacity="0.22" class="orb-marker-pulse"/>${ring}<circle r="${r}" fill="${white}" stroke="${MAP_COLORS.arrived}" stroke-width="3"/>${text(MAP_COLORS.arrived)}`;
    case "arrived":
      return `${ring}<circle r="${r}" fill="${MAP_COLORS.arrived}" stroke="${white}" stroke-width="2"/>${text(white)}`;
    case "late":
      return `${ring}<circle r="${r}" fill="${white}" stroke="${MAP_COLORS.late}" stroke-width="3"/>${text(MAP_COLORS.late)}${badge(MAP_COLORS.late)}`;
    case "risk":
      return `${ring}<circle r="${r}" fill="${white}" stroke="${MAP_COLORS.risk}" stroke-width="3"/>${text(COLOR.fg)}${badge(MAP_COLORS.risk)}`;
    case "exception":
      return `${ring}<circle r="${r}" fill="${MAP_COLORS.exception}" stroke="${white}" stroke-width="2"/>${text(white)}`;
    default:
      return `${ring}<circle r="${r}" fill="${white}" stroke="${COLOR.fgMuted}" stroke-width="2"/>${text(COLOR.fg)}`;
  }
}

/** Agrupamento: círculo com a quantidade. */
export function clusterSvg(count: number): string {
  return `<circle r="17" fill="${COLOR.fg}" opacity="0.9" stroke="${COLOR.surface}" stroke-width="2.5"/><text text-anchor="middle" dy="4.5" font-size="13" font-weight="700" fill="${COLOR.surface}" font-family="ui-sans-serif,system-ui">${count}</text>`;
}

/** Elemento DOM do marcador (Google AdvancedMarker). */
export function markerElement(m: MapMarker): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-label", m.title);
  el.dataset.markerId = m.id;
  el.style.cssText = `position:relative;transform:translateY(50%);opacity:${m.muted ? 0.45 : 1};transition:opacity 200ms`;
  const size = m.kind === "vehicle" ? 52 : 34;
  el.innerHTML = `<svg width="${size}" height="${size}" viewBox="${-size / 2} ${-size / 2} ${size} ${size}" style="overflow:visible;display:block;filter:drop-shadow(0 1px 1.5px rgb(22 22 22 / .35))">${markerSvg(m)}</svg>`;
  if (m.caption) {
    const cap = document.createElement("span");
    cap.textContent = m.caption;
    cap.style.cssText = `position:absolute;left:${size / 2 + 2}px;top:50%;transform:translateY(-50%);white-space:nowrap;font:600 12px/16px var(--font-geist-mono),ui-monospace,monospace;color:${COLOR.fg};background:${COLOR.surface};border:1px solid ${COLOR.mapGrid};border-radius:4px;padding:1px 6px;box-shadow:0 1px 2px rgb(22 22 22 / .12)`;
    el.appendChild(cap);
  }
  return el;
}
