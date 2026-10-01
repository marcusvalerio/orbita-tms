/// <reference types="google.maps" />
import { MapLoadError, type GeoPoint, type MapHandle, type MapMarker, type MapProvider, type MapScene } from "../types";
import { markerElement, POLYLINE_STYLES } from "../marker-style";

// MapProvider com Google Maps JavaScript API (somente navegador).
// A chave chega em runtime, vinda do servidor (nunca embutida no bundle) e
// deve ser restrita por HTTP referrer no Google Cloud Console.

let loading: Promise<void> | null = null;
const failureListeners = new Set<(reason: string) => void>();
const AUTH_FAILURE = "A chave do Google Maps foi recusada (restrição de domínio, API desabilitada ou cobrança não habilitada no projeto).";

function loadScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new MapLoadError("Mapa só carrega no navegador."));
  if (typeof window.google?.maps?.importLibrary === "function") return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const callback = "__orbitaGoogleMapsReady";
    (window as unknown as Record<string, unknown>)[callback] = () => resolve();
    // Falha de autenticação da chave (referrer, API desabilitada, cobrança).
    // O Google pode sinalizá-la antes OU depois do carregamento.
    (window as unknown as Record<string, unknown>).gm_authFailure = () => {
      reject(new MapLoadError(AUTH_FAILURE));
      failureListeners.forEach((l) => l(AUTH_FAILURE));
    };
    const script = document.createElement("script");
    const params = new URLSearchParams({ key: apiKey, v: "weekly", loading: "async", callback, language: "pt-BR", region: "BR" });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => reject(new MapLoadError("Não foi possível carregar o Google Maps (rede)."));
    document.head.appendChild(script);
    setTimeout(() => reject(new MapLoadError("Tempo esgotado ao carregar o Google Maps.")), 15_000);
  }).catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

export class GoogleMapProvider implements MapProvider {
  readonly id = "google" as const;
  private libs: { maps: google.maps.MapsLibrary; marker: google.maps.MarkerLibrary } | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly mapId: string
  ) {}

  onRuntimeFailure(listener: (reason: string) => void) {
    failureListeners.add(listener);
    return () => failureListeners.delete(listener);
  }

  async load() {
    await loadScript(this.apiKey);
    const [maps, marker] = await Promise.all([
      google.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
      google.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
    ]);
    this.libs = { maps, marker };
  }

  create(container: HTMLElement): MapHandle {
    if (!this.libs) throw new MapLoadError("GoogleMapProvider.load() não foi chamado.");
    const { maps, marker: markerLib } = this.libs;
    const map = new maps.Map(container, {
      mapId: this.mapId,
      // Base clara; o estilo dessaturado do ÓRBITA vem do Map ID (estilização
      // na nuvem — ver docs/orbita-2.0/phase-2/google-map-style.json).
      colorScheme: "LIGHT",
      center: { lat: -22.9, lng: -43.3 },
      zoom: 10,
      disableDefaultUI: true,
      zoomControl: false, // controles próprios do ÓRBITA (MapControls)
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: "greedy",
    });

    const markers = new Map<string, google.maps.marker.AdvancedMarkerElement>();
    const markerData = new Map<string, MapMarker>();
    let polylines: google.maps.Polyline[] = [];
    let clickListener: ((id: string) => void) | null = null;

    const upsertMarker = (m: MapMarker) => {
      const content = markerElement(m);
      const existing = markers.get(m.id);
      if (existing) {
        existing.position = m.position;
        existing.content = content;
        existing.title = m.title;
        existing.zIndex = m.kind === "vehicle" ? (m.selected ? 1100 : 1000) : m.selected ? 500 : 100;
      } else {
        const adv = new markerLib.AdvancedMarkerElement({
          map,
          position: m.position,
          content,
          title: m.title,
          gmpClickable: true,
          zIndex: m.kind === "vehicle" ? 1000 : 100,
        });
        adv.addListener("gmp-click", () => clickListener?.(m.id));
        markers.set(m.id, adv);
      }
      markerData.set(m.id, m);
    };

    return {
      setScene(scene: MapScene) {
        const ids = new Set(scene.markers.map((m) => m.id));
        markers.forEach((mk, id) => {
          if (!ids.has(id)) {
            mk.map = null;
            markers.delete(id);
            markerData.delete(id);
          }
        });
        scene.markers.forEach(upsertMarker);
        polylines.forEach((p) => p.setMap(null));
        polylines = scene.polylines.flatMap((line) => {
          const { casing, dashed, ...style } = POLYLINE_STYLES[line.kind];
          const out: google.maps.Polyline[] = [];
          if (casing) out.push(new maps.Polyline({ map, path: line.path, clickable: false, strokeColor: "#ffffff", strokeOpacity: 1, strokeWeight: casing, zIndex: style.zIndex - 1 }));
          out.push(
            new maps.Polyline({
              map,
              path: line.path,
              clickable: false,
              ...style,
              ...(dashed ? { strokeOpacity: 0, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: style.strokeOpacity, strokeColor: style.strokeColor, scale: 3 }, offset: "0", repeat: "12px" }] } : {}),
            })
          );
          return out;
        });
      },
      moveMarkers(updates) {
        for (const u of updates) {
          const mk = markers.get(u.id);
          const data = markerData.get(u.id);
          if (!mk || !data) continue;
          mk.position = u.position;
          if (u.headingDeg !== undefined && u.headingDeg !== data.headingDeg) {
            markerData.set(u.id, { ...data, position: u.position, headingDeg: u.headingDeg });
            // Gira só a seta, sem recriar o elemento (movimento sem saltos).
            (mk.content as HTMLElement | null)?.querySelector(".orb-heading")?.setAttribute("transform", `rotate(${Math.round(u.headingDeg)})`);
          }
        }
      },
      fitBounds(points: GeoPoint[]) {
        if (points.length === 0) return;
        const bounds = new google.maps.LatLngBounds();
        points.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds, 64);
      },
      onMarkerClick(listener) {
        clickListener = listener;
      },
      panTo(point: GeoPoint) {
        map.panTo(point);
      },
      zoomBy(delta: number) {
        map.setZoom((map.getZoom() ?? 10) + delta);
      },
      destroy() {
        markers.forEach((m) => (m.map = null));
        polylines.forEach((p) => p.setMap(null));
        markers.clear();
      },
    };
  }
}
