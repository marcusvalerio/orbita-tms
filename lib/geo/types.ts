// Contratos de geolocalização do ÓRBITA. A interface e o domínio dependem
// destas interfaces — nunca de um SDK de mapas. Trocar Google por outro
// provedor = nova implementação destas portas, sem reescrever telas.

export interface GeoPoint {
  lat: number;
  lng: number;
}

// --- Mapa (renderização) ---------------------------------------------------------

export type MarkerKind = "origin" | "stop" | "destination" | "vehicle";
export type MarkerState = "pending" | "arrived" | "done" | "exception";

export interface MapMarker {
  id: string;
  position: GeoPoint;
  kind: MarkerKind;
  label?: string; // texto curto no pino (ex.: sequência da parada)
  title: string; // nome acessível / tooltip
  state?: MarkerState;
  selected?: boolean;
  headingDeg?: number; // veículos
}

export interface MapPolyline {
  id: string;
  path: GeoPoint[];
  kind: "route" | "route-muted" | "route-done";
}

/** Cena declarativa: a tela descreve o que mostrar; o provedor desenha. */
export interface MapScene {
  markers: MapMarker[];
  polylines: MapPolyline[];
}

export interface MapHandle {
  setScene(scene: MapScene): void;
  /** Caminho rápido para animação: move marcadores existentes sem redesenhar a cena. */
  moveMarkers(updates: { id: string; position: GeoPoint; headingDeg?: number }[]): void;
  fitBounds(points: GeoPoint[]): void;
  onMarkerClick(listener: (markerId: string) => void): void;
  destroy(): void;
}

export interface MapProvider {
  readonly id: "google" | "schematic";
  /** Carrega o SDK (se houver). Rejeita com MapLoadError se indisponível. */
  load(): Promise<void>;
  create(container: HTMLElement): MapHandle;
  /** Falha que o provedor só descobre depois de carregar (ex.: chave recusada). */
  onRuntimeFailure?(listener: (reason: string) => void): () => void;
}

export class MapLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MapLoadError";
  }
}

// --- Rotas ---------------------------------------------------------------------------

export interface RouteLeg {
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteResult {
  path: GeoPoint[];
  distanceMeters: number;
  durationSeconds: number;
  legs: RouteLeg[]; // uma perna entre cada par de paradas consecutivas
  /** De onde veio o cálculo — a interface informa quando é estimativa. */
  source: "google-routes" | "estimate";
}

export interface RouteProvider {
  computeRoute(stops: GeoPoint[], options?: { departureTime?: string }): Promise<RouteResult>;
}

// --- Geocodificação ------------------------------------------------------------------

export interface GeocodeResult {
  label: string;
  position: GeoPoint;
  source: "google-geocoding" | "catalog";
}

export interface GeocodingProvider {
  geocode(query: string): Promise<GeocodeResult[]>;
}

// --- Rastreamento --------------------------------------------------------------------
// Mesmo contrato para simulação (DemoTrackingProvider), GPS próprio ou
// Google Fleet Engine / Last Mile Fleet Solution no futuro.

export type StopProgress = "Pendente" | "Em rota" | "Chegou" | "Em descarga" | "Entregue";

export interface VehiclePosition {
  shipmentId: string;
  vehicleId?: string;
  position: GeoPoint;
  headingDeg: number;
  speedKmh: number;
  progress: number; // 0–1 da distância total da rota
  stopProgress: StopProgress[]; // por parada, na ordem da rota
  etaByStop: (string | null)[]; // ISO — chegada prevista (null = já atendida)
  recordedAt: string; // ISO — instante (simulado ou real) da leitura
  source: "demo" | "gps" | "fleet-engine";
}

export interface TrackingProvider {
  subscribe(listener: (positions: VehiclePosition[]) => void): () => void;
  getSnapshot(): VehiclePosition[];
}
