import type { GeoPoint, MapHandle, MapMarker, MapProvider, MapScene } from "../types";
import { POLYLINE_STYLES, markerSvg, clusterSvg, markerRadius } from "../marker-style";
import { COLOR, DURATION, EASE, prefersReducedMotion } from "../../design/tokens";

// MapProvider esquemático em SVG — sem rede, sem chave, determinístico.
// Usado quando o Google Maps não está configurado ou falha, e em testes.
// Visual 2.0: base clara e dessaturada, câmera animada (fitBounds/panTo),
// arrastar e zoom, agrupamento de veículos próximos, rótulos e a rota
// selecionada "desenhada" uma vez.

const NS = "http://www.w3.org/2000/svg";
const W = 1000;
const H = 700;
const PAD = 90;
// Faixa superior reservada aos controles flutuantes (filtros, simulação).
const PAD_TOP = 140;
// Faixa lateral onde ficam os trilhos de controles (esquerda ou direita, por tela).
const RAIL_PX = 64;
const CLUSTER_PX = 30;

/** Y de Web Mercator na MESMA unidade da longitude (graus), para escala uniforme. */
export function mercatorY(lat: number) {
  const r = (lat * Math.PI) / 180;
  return (Math.log(Math.tan(Math.PI / 4 + r / 2)) * 180) / Math.PI;
}

interface View {
  cx: number; // longitude do centro
  cy: number; // mercatorY do centro
  s: number; // px por grau
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export class SchematicMapProvider implements MapProvider {
  readonly id = "schematic" as const;
  async load() {}

  create(container: HTMLElement): MapHandle {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-roledescription", "mapa");
    svg.setAttribute("aria-label", "Mapa esquemático da operação");
    svg.style.cssText = `width:100%;height:100%;display:block;background:${COLOR.mapLand};touch-action:none;cursor:grab;user-select:none`;
    svg.innerHTML = `<defs><pattern id="orb-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="${COLOR.mapGrid}" stroke-width="1"/></pattern><pattern id="orb-grid-lg" width="240" height="240" patternUnits="userSpaceOnUse"><path d="M240 0H0V240" fill="none" stroke="${COLOR.mapGrid}" stroke-width="2"/></pattern></defs><rect class="orb-bg" width="${W}" height="${H}" fill="url(#orb-grid)"/><rect width="${W}" height="${H}" fill="url(#orb-grid-lg)" pointer-events="none"/>`;
    const lines = document.createElementNS(NS, "g");
    const captions = document.createElementNS(NS, "g");
    const marks = document.createElementNS(NS, "g");
    svg.append(lines, captions, marks);
    container.appendChild(svg);

    let view: View = { cx: -43.3, cy: mercatorY(-22.9), s: 300 };
    let scene: MapScene = { markers: [], polylines: [] };
    let clickListener: ((id: string) => void) | null = null;
    let anim: number | null = null;
    let drawnRouteId: string | null = null;
    const reduced = prefersReducedMotion();

    const project = (p: GeoPoint) => ({ x: W / 2 + (p.lng - view.cx) * view.s, y: H / 2 - (mercatorY(p.lat) - view.cy) * view.s });

    const animateTo = (target: View, ms: number = DURATION.slow + 120) => {
      if (anim !== null) cancelAnimationFrame(anim);
      if (reduced || ms === 0) {
        view = target;
        render();
        return;
      }
      const from = view;
      const t0 = performance.now();
      const step = (now: number) => {
        const k = easeOut(Math.min(1, (now - t0) / ms));
        view = { cx: from.cx + (target.cx - from.cx) * k, cy: from.cy + (target.cy - from.cy) * k, s: from.s * Math.pow(target.s / from.s, k) };
        render();
        anim = k < 1 ? requestAnimationFrame(step) : null;
      };
      anim = requestAnimationFrame(step);
    };

    const markerNode = (m: MapMarker, pos?: { x: number; y: number }) => {
      const { x, y } = pos ?? project(m.position);
      const g = document.createElementNS(NS, "g");
      g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      g.setAttribute("data-marker-id", m.id);
      g.setAttribute("role", "button");
      g.setAttribute("tabindex", "0");
      g.setAttribute("aria-label", m.title);
      g.setAttribute("style", `cursor:pointer;opacity:${m.muted ? 0.4 : 1};transition:opacity ${DURATION.base}ms`);
      g.innerHTML = `<title>${m.title.replace(/</g, "&lt;")}</title>${markerSvg(m)}`;
      const activate = (e: Event) => {
        e.stopPropagation();
        clickListener?.(m.id);
      };
      g.addEventListener("click", activate);
      g.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") activate(e);
      });
      return g;
    };

    const captionNode = (m: MapMarker, x: number, y: number, side: "right" | "left" = "right") => {
      const t = document.createElementNS(NS, "text");
      const r = markerRadius(m);
      t.setAttribute("x", (side === "right" ? x + r + 6 : x - r - 6).toFixed(1));
      if (side === "left") t.setAttribute("text-anchor", "end");
      t.dataset.side = side;
      t.setAttribute("y", (y + 4).toFixed(1));
      t.setAttribute("font-size", "12");
      t.setAttribute("font-weight", m.kind === "vehicle" ? "600" : "500");
      t.setAttribute("fill", m.kind === "vehicle" ? COLOR.fg : COLOR.mapLabel);
      t.setAttribute("stroke", COLOR.mapLand);
      t.setAttribute("stroke-width", "4");
      t.setAttribute("paint-order", "stroke");
      t.setAttribute("font-family", m.kind === "vehicle" ? "var(--font-geist-mono),ui-monospace,monospace" : "var(--font-inter),ui-sans-serif,system-ui");
      t.setAttribute("pointer-events", "none");
      t.textContent = m.caption ?? "";
      t.dataset.for = m.id;
      return t;
    };

    // Rótulos sem colisão: veículos primeiro; um rótulo que encostaria em
    // outro tenta o lado esquerdo e, se ainda colidir, é omitido (o marcador
    // continua com título acessível). Refeito a cada render e, com veículos
    // em movimento, no máximo 2×/s.
    let visibleIds: string[] = [];
    let lastLayout = 0;
    const layoutCaptions = () => {
      lastLayout = performance.now();
      const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
      const hit = (box: (typeof placed)[number], list: typeof placed) => list.some((o) => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0);
      const byId = new Map(scene.markers.map((m) => [m.id, m]));
      // Marcadores também são obstáculos para rótulos de lugar (o de veículo,
      // mais importante, só evita outros rótulos).
      const markerBoxes: typeof placed = [];
      // Bordas laterais (trilhos de controles) bloqueiam rótulos, inclusive o do veículo.
      const rect = svg.getBoundingClientRect();
      if (rect.width && rect.height) {
        const k = Math.min(W / rect.width, H / rect.height);
        const half = (rect.width * k) / 2;
        placed.push({ x0: -1e6, x1: W / 2 - half + RAIL_PX * k, y0: -1e6, y1: 1e6 }, { x0: W / 2 + half - RAIL_PX * k, x1: 1e6, y0: -1e6, y1: 1e6 });
      }
      for (const id of visibleIds) {
        const m = byId.get(id);
        if (!m) continue;
        const p = project(m.position);
        const r = markerRadius(m);
        markerBoxes.push({ x0: p.x - r, x1: p.x + r, y0: p.y - r, y1: p.y + r });
      }
      const nodes = visibleIds
        .map((id) => byId.get(id))
        .filter((m): m is MapMarker => !!m?.caption)
        .reverse()
        .flatMap((m) => {
          const p = project(m.position);
          const w = (m.caption ?? "").length * 7.2 + 4;
          const r = markerRadius(m) + 4;
          const right = { x0: p.x + r, x1: p.x + r + w, y0: p.y - 9, y1: p.y + 9 };
          const left = { x0: p.x - r - w, x1: p.x - r, y0: p.y - 9, y1: p.y + 9 };
          const vehicle = m.kind === "vehicle";
          const fits = (box: (typeof placed)[number]) => !hit(box, placed) && (vehicle || !hit(box, markerBoxes));
          const side = fits(right) ? "right" : fits(left) ? "left" : null;
          if (!side) return [];
          placed.push(side === "right" ? right : left);
          return [captionNode(m, p.x, p.y, side)];
        });
      captions.replaceChildren(...nodes);
    };

    const render = () => {
      // Linhas
      const routeEls: SVGPolylineElement[] = [];
      lines.replaceChildren(
        ...scene.polylines.flatMap((l) => {
          const style = POLYLINE_STYLES[l.kind];
          const pts = l.path.map((p) => {
            const q = project(p);
            return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
          }).join(" ");
          const mk = (color: string, width: number, opacity: number) => {
            const el = document.createElementNS(NS, "polyline");
            el.setAttribute("points", pts);
            el.setAttribute("fill", "none");
            el.setAttribute("stroke", color);
            el.setAttribute("stroke-opacity", String(opacity));
            el.setAttribute("stroke-width", String(width));
            el.setAttribute("stroke-linejoin", "round");
            el.setAttribute("stroke-linecap", "round");
            if (style.dashed) el.setAttribute("stroke-dasharray", "2 8");
            return el;
          };
          const main = mk(style.strokeColor, style.strokeWeight, style.strokeOpacity);
          main.dataset.lineId = l.id;
          if (l.kind === "route") routeEls.push(main);
          return style.casing ? [mk(COLOR.mapRoad, style.casing, 1), main] : [main];
        })
      );

      // Marcadores: veículos por cima; veículos não selecionados próximos viram grupo.
      const projected = scene.markers.map((m) => ({ m, p: project(m.position) }));
      const vehicles = projected.filter((x) => x.m.kind === "vehicle" && !x.m.selected);
      const used = new Set<string>();
      const clusters: { members: typeof vehicles; x: number; y: number }[] = [];
      for (const v of vehicles) {
        if (used.has(v.m.id)) continue;
        const members = vehicles.filter((o) => !used.has(o.m.id) && Math.hypot(o.p.x - v.p.x, o.p.y - v.p.y) < CLUSTER_PX);
        members.forEach((o) => used.add(o.m.id));
        if (members.length > 1) clusters.push({ members, x: members.reduce((a, o) => a + o.p.x, 0) / members.length, y: members.reduce((a, o) => a + o.p.y, 0) / members.length });
      }
      const clustered = new Set(clusters.flatMap((c) => c.members.map((o) => o.m.id)));
      const order = (m: MapMarker) => (m.kind === "vehicle" ? (m.selected ? 3 : 2) : m.selected ? 1 : 0);
      const visible = projected.filter((x) => !clustered.has(x.m.id)).sort((a, b) => order(a.m) - order(b.m));

      visibleIds = visible.map((x) => x.m.id);
      layoutCaptions();
      marks.replaceChildren(
        ...visible.map((x) => markerNode(x.m, x.p)),
        ...clusters.map((c) => {
          const g = document.createElementNS(NS, "g");
          g.setAttribute("transform", `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`);
          g.setAttribute("role", "button");
          g.setAttribute("tabindex", "0");
          const label = `${c.members.length} veículos próximos — aproximar`;
          g.setAttribute("aria-label", label);
          g.style.cursor = "pointer";
          g.innerHTML = `<title>${label}</title>${clusterSvg(c.members.length)}`;
          g.addEventListener("click", (e) => {
            e.stopPropagation();
            handle.fitBounds(c.members.map((o) => o.m.position));
          });
          return g;
        })
      );

      // Rota selecionada desenhada uma vez (motion de seleção).
      const selected = routeEls[0];
      if (selected && selected.dataset.lineId !== drawnRouteId) {
        drawnRouteId = selected.dataset.lineId ?? null;
        if (!reduced && typeof selected.getTotalLength === "function") {
          const len = selected.getTotalLength();
          selected.animate([{ strokeDasharray: `${len} ${len}`, strokeDashoffset: len }, { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 }], {
            duration: 640,
            easing: EASE.standard,
          });
        }
      } else if (!selected) drawnRouteId = null;
    };

    // Arrastar para mover; roda do mouse para zoom no ponto.
    let drag: { x: number; y: number; view: View } | null = null;
    const toSvg = (e: { clientX: number; clientY: number }) => {
      const r = svg.getBoundingClientRect();
      const k = Math.min(W / r.width, H / r.height); // "slice": unidades do viewBox por pixel
      return { x: W / 2 + (e.clientX - r.left - r.width / 2) * k, y: H / 2 + (e.clientY - r.top - r.height / 2) * k, k };
    };
    svg.addEventListener("pointerdown", (e) => {
      if ((e.target as Element).closest("[data-marker-id],[role=button]")) return;
      drag = { x: e.clientX, y: e.clientY, view };
      svg.setPointerCapture(e.pointerId);
      svg.style.cursor = "grabbing";
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const { k } = toSvg(e);
      view = { ...drag.view, cx: drag.view.cx - ((e.clientX - drag.x) * k) / view.s, cy: drag.view.cy + ((e.clientY - drag.y) * k) / view.s };
      render();
    });
    const endDrag = () => {
      drag = null;
      svg.style.cursor = "grab";
    };
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    svg.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const { x, y } = toSvg(e);
        const factor = Math.exp(-e.deltaY * 0.0015);
        const lng = view.cx + (x - W / 2) / view.s;
        const my = view.cy - (y - H / 2) / view.s;
        const s = Math.max(20, Math.min(200000, view.s * factor));
        view = { s, cx: lng - (x - W / 2) / s, cy: my + (y - H / 2) / s };
        render();
      },
      { passive: false }
    );

    const handle: MapHandle = {
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
        // Caminho rápido: só translada o grupo e gira a seta (sem recriar nós).
        let needsFull = false;
        for (const u of updates) {
          const node = marks.querySelector<SVGGElement>(`[data-marker-id="${CSS.escape(u.id)}"]`);
          if (!node) {
            needsFull = true;
            continue;
          }
          const { x, y } = project(u.position);
          node.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
          if (u.headingDeg !== undefined) node.querySelector(".orb-heading")?.setAttribute("transform", `rotate(${Math.round(u.headingDeg)})`);
          const m = scene.markers.find((mm) => mm.id === u.id);
          const cap = m?.caption ? captions.querySelector<SVGTextElement>(`[data-for="${CSS.escape(u.id)}"]`) : null;
          if (m && cap) {
            cap.setAttribute("x", (cap.dataset.side === "left" ? x - markerRadius(m) - 6 : x + markerRadius(m) + 6).toFixed(1));
            cap.setAttribute("y", (y + 4).toFixed(1));
          }
        }
        if (needsFull) render();
        else if (performance.now() - lastLayout > 500) layoutCaptions();
      },
      fitBounds(points) {
        if (points.length === 0) return;
        const xs = points.map((p) => p.lng);
        const ys = points.map((p) => mercatorY(p.lat));
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const r = svg.getBoundingClientRect();
        // Área visível em unidades do viewBox (preserveAspectRatio slice).
        const k = r.width && r.height ? Math.min(W / r.width, H / r.height) : 1;
        const visW = r.width ? r.width * k : W;
        const visH = r.height ? r.height * k : H;
        const sx = (visW - 2 * PAD) / Math.max(maxX - minX, 0.004);
        const sy = (visH - PAD - PAD_TOP) / Math.max(maxY - minY, 0.004);
        const s = Math.min(sx, sy, 60000);
        // Centro deslocado para baixo metade da faixa reservada.
        animateTo({ cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 + (PAD_TOP - PAD) / 2 / s, s });
      },
      panTo(point) {
        animateTo({ ...view, cx: point.lng, cy: mercatorY(point.lat) }, DURATION.slow);
      },
      zoomBy(delta) {
        animateTo({ ...view, s: view.s * Math.pow(1.8, delta) }, DURATION.base + 60);
      },
      onMarkerClick(listener) {
        clickListener = listener;
      },
      destroy() {
        if (anim !== null) cancelAnimationFrame(anim);
        svg.remove();
      },
    };
    return handle;
  }
}
