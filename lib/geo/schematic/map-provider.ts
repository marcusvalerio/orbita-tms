import type { GeoPoint, MapHandle, MapMarker, MapProvider, MapScene } from "../types";
import { MAP_COLORS, POLYLINE_STYLES } from "../marker-style";

// MapProvider esquemático em SVG — sem rede, sem chave, determinístico.
// Usado quando o Google Maps não está configurado ou falha, e em testes.
// Projeção Web Mercator ajustada aos limites da cena.

const NS = "http://www.w3.org/2000/svg";
const W = 1000;
const H = 700;
const PAD = 60;

/** Y de Web Mercator na MESMA unidade da longitude (graus), para escala uniforme. */
export function mercatorY(lat: number) {
  const r = (lat * Math.PI) / 180;
  return (Math.log(Math.tan(Math.PI / 4 + r / 2)) * 180) / Math.PI;
}

export class SchematicMapProvider implements MapProvider {
  readonly id = "schematic" as const;
  async load() {}

  create(container: HTMLElement): MapHandle {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Mapa esquemático da operação");
    svg.style.cssText = "width:100%;height:100%;display:block;background:#1b1b1b";
    svg.innerHTML = `<defs><pattern id="orbita-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#2a2a2a" stroke-width="1"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#orbita-grid)"/>`;
    const lines = document.createElementNS(NS, "g");
    const marks = document.createElementNS(NS, "g");
    svg.append(lines, marks);
    container.appendChild(svg);

    let bounds = { minX: -46, maxX: -43, minY: mercatorY(-24), maxY: mercatorY(-22) };
    let scene: MapScene = { markers: [], polylines: [] };
    let clickListener: ((id: string) => void) | null = null;

    const project = (p: GeoPoint) => {
      const sx = (W - 2 * PAD) / (bounds.maxX - bounds.minX || 1);
      const sy = (H - 2 * PAD) / (bounds.maxY - bounds.minY || 1);
      const s = Math.min(sx, sy);
      const ox = (W - s * (bounds.maxX - bounds.minX)) / 2;
      const oy = (H - s * (bounds.maxY - bounds.minY)) / 2;
      return { x: ox + (p.lng - bounds.minX) * s, y: H - (oy + (mercatorY(p.lat) - bounds.minY) * s) };
    };

    const markerNode = (m: MapMarker) => {
      const { x, y } = project(m.position);
      const g = document.createElementNS(NS, "g");
      g.setAttribute("transform", `translate(${x} ${y})`);
      g.setAttribute("data-marker-id", m.id);
      g.setAttribute("role", "button");
      g.setAttribute("tabindex", "0");
      g.setAttribute("aria-label", m.title);
      g.style.cursor = "pointer";
      const title = document.createElementNS(NS, "title");
      title.textContent = m.title;
      g.appendChild(title);
      if (m.kind === "vehicle") {
        g.innerHTML += `<g transform="rotate(${m.headingDeg ?? 0})"><circle r="17" fill="${m.selected ? MAP_COLORS.route : "#f5f5f5"}" stroke="#161616" stroke-width="2.5"/><path d="M0 -10 L8 7 L0 3 L-8 7 Z" fill="${m.selected ? "#fff" : "#161616"}"/></g>`;
      } else {
        const fill = m.kind === "origin" ? "#f5f5f5" : m.state === "done" ? MAP_COLORS.done : m.state === "arrived" ? MAP_COLORS.arrived : m.state === "exception" ? MAP_COLORS.exception : "#1b1b1b";
        const text = m.kind === "origin" || (!m.state || m.state === "pending") ? (m.kind === "origin" ? "#161616" : "#f5f5f5") : "#fff";
        const r = m.selected ? 17 : 15;
        g.innerHTML += m.kind === "origin"
          ? `<rect x="-${r}" y="-${r}" width="${2 * r}" height="${2 * r}" rx="4" fill="${fill}" stroke="#161616" stroke-width="2"/><text text-anchor="middle" dy="4" font-size="11" font-weight="700" fill="${text}">CD</text>`
          : `<circle r="${r}" fill="${fill}" stroke="#f5f5f5" stroke-width="2"/><text text-anchor="middle" dy="4" font-size="14" font-weight="700" fill="${text}">${m.label ?? ""}</text>`;
      }
      const activate = () => clickListener?.(m.id);
      g.addEventListener("click", activate);
      g.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") activate();
      });
      return g;
    };

    const render = () => {
      lines.replaceChildren(
        ...scene.polylines.map((l) => {
          const el = document.createElementNS(NS, "polyline");
          const style = POLYLINE_STYLES[l.kind];
          el.setAttribute("points", l.path.map((p) => { const q = project(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" "));
          el.setAttribute("fill", "none");
          el.setAttribute("stroke", style.strokeColor === MAP_COLORS.route ? "#FF7A3D" : style.strokeColor);
          el.setAttribute("stroke-opacity", String(style.strokeOpacity));
          el.setAttribute("stroke-width", String(style.strokeWeight - 1));
          el.setAttribute("stroke-linejoin", "round");
          el.setAttribute("stroke-linecap", "round");
          return el;
        })
      );
      const ordered = [...scene.markers].sort((a, b) => (a.kind === "vehicle" ? 1 : 0) - (b.kind === "vehicle" ? 1 : 0));
      marks.replaceChildren(...ordered.map(markerNode));
    };

    return {
      setScene(next) {
        scene = next;
        render();
      },
      moveMarkers(updates) {
        const byId = new Map(updates.map((u) => [u.id, u]));
        scene = {
          ...scene,
          markers: scene.markers.map((m) => {
            const u = byId.get(m.id);
            return u ? { ...m, position: u.position, headingDeg: u.headingDeg ?? m.headingDeg } : m;
          }),
        };
        updates.forEach((u) => {
          const node = marks.querySelector(`[data-marker-id="${CSS.escape(u.id)}"]`);
          const m = scene.markers.find((x) => x.id === u.id);
          if (node && m) node.replaceWith(markerNode(m));
        });
      },
      fitBounds(points) {
        if (points.length === 0) return;
        const xs = points.map((p) => p.lng);
        const ys = points.map((p) => mercatorY(p.lat));
        const padX = (Math.max(...xs) - Math.min(...xs)) * 0.08 || 0.02;
        const padY = (Math.max(...ys) - Math.min(...ys)) * 0.08 || 0.02;
        bounds = { minX: Math.min(...xs) - padX, maxX: Math.max(...xs) + padX, minY: Math.min(...ys) - padY, maxY: Math.max(...ys) + padY };
        render();
      },
      onMarkerClick(listener) {
        clickListener = listener;
      },
      destroy() {
        svg.remove();
      },
    };
  }
}
