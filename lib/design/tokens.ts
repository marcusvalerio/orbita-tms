// Espelho em TypeScript dos tokens de cor que precisam existir fora do CSS
// (ex.: polylines do Google Maps, que recebem hex e não variáveis CSS).
// A fonte da verdade é app/globals.css; lib/design/contrast.test.ts garante
// que os valores aqui continuam iguais aos de lá.

export const COLOR = {
  fg: "#161616",
  fgMuted: "#57554f",
  surface: "#ffffff",
  canvas: "#f6f5f0",
  brand: "#ff5b19",
  route: "#dc4409",
  routeMuted: "#9b998e",
  routeDone: "#c2c0b4",
  vehicle: "#161616",
  info: "#2f6fdb",
  success: "#1a8f50",
  warning: "#b87500",
  danger: "#d92d20",
  critical: "#9b1c1c",
  exception: "#7c3aed",
  delivery: "#0e7490",
  mapLand: "#edece5",
  mapGrid: "#e2e0d7",
  mapRoad: "#ffffff",
  mapWater: "#d6dfe3",
  mapPark: "#e2e7da",
  mapLabel: "#57554f",
} as const;

/** Nome da variável CSS correspondente a cada chave acima (para o teste de paridade). */
export const COLOR_CSS_VAR: Record<keyof typeof COLOR, string> = {
  fg: "--orb-fg",
  fgMuted: "--orb-fg-muted",
  surface: "--orb-surface",
  canvas: "--orb-canvas",
  brand: "--orb-brand",
  route: "--orb-route",
  routeMuted: "--orb-route-muted",
  routeDone: "--orb-route-done",
  vehicle: "--orb-vehicle",
  info: "--orb-info",
  success: "--orb-success",
  warning: "--orb-warning",
  danger: "--orb-danger",
  critical: "--orb-critical",
  exception: "--orb-exception",
  delivery: "--orb-delivery",
  mapLand: "--orb-map-land",
  mapGrid: "--orb-map-grid",
  mapRoad: "--orb-map-road",
  mapWater: "--orb-map-water",
  mapPark: "--orb-map-park",
  mapLabel: "--orb-map-label",
};

/** Durações de motion em ms (para Web Animations API). Espelham --orb-duration-*. */
export const DURATION = { instant: 80, fast: 140, base: 200, slow: 320, status: 900 } as const;
export const EASE = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  enter: "cubic-bezier(0, 0, 0, 1)",
  exit: "cubic-bezier(0.3, 0, 1, 1)",
} as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
