"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoPoint, MapHandle, MapProvider, MapScene } from "@/lib/geo/types";
import { SchematicMapProvider } from "@/lib/geo/schematic/map-provider";

export type MapStatus = { kind: "loading" } | { kind: "ready"; provider: MapProvider["id"] } | { kind: "fallback"; reason: string };

/**
 * Superfície do mapa. Não conhece Google: recebe um MapProvider, tenta
 * carregá-lo e, se falhar, cai para o mapa esquemático — o restante da
 * tela continua funcionando.
 */
export function MapCanvas({
  provider,
  scene,
  fitKey,
  fitPoints,
  onMarkerClick,
  onHandle,
  onStatus,
}: {
  provider: MapProvider;
  scene: MapScene;
  fitKey: string;
  fitPoints: GeoPoint[];
  onMarkerClick: (id: string) => void;
  onHandle?: (handle: MapHandle | null) => void;
  onStatus?: (status: MapStatus) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [handle, setHandle] = useState<MapHandle | null>(null);
  const clickRef = useRef(onMarkerClick);
  const statusRef = useRef(onStatus);
  const handleRef = useRef(onHandle);

  useEffect(() => {
    clickRef.current = onMarkerClick;
    statusRef.current = onStatus;
    handleRef.current = onHandle;
  });

  useEffect(() => {
    let disposed = false;
    let created: MapHandle | null = null;
    const el = containerRef.current!;
    statusRef.current?.({ kind: "loading" });

    const mount = (p: MapProvider) => {
      created = p.create(el);
      created.onMarkerClick((id) => clickRef.current(id));
      setHandle(created);
      handleRef.current?.(created);
    };

    const fallBack = (reason: string) => {
      if (disposed) return;
      // Nunca silencioso: o motivo vai para o console e para o selo "Mapa esquemático".
      console.warn(`[ÓRBITA] Google Maps indisponível — usando o mapa esquemático. Motivo: ${reason}`);
      created?.destroy();
      el.replaceChildren();
      mount(new SchematicMapProvider());
      statusRef.current?.({ kind: "fallback", reason });
    };
    const stopListening = provider.onRuntimeFailure?.(fallBack);

    provider
      .load()
      .then(() => {
        if (disposed) return;
        mount(provider);
        statusRef.current?.({ kind: "ready", provider: provider.id });
      })
      .catch((err: Error) => fallBack(err.message));

    return () => {
      disposed = true;
      stopListening?.();
      created?.destroy();
      handleRef.current?.(null);
      setHandle(null);
    };
  }, [provider]);

  useEffect(() => {
    handle?.setScene(scene);
  }, [handle, scene]);

  // Viewport automático quando a seleção muda (não a cada quadro da simulação).
  useEffect(() => {
    if (handle && fitPoints.length > 0) handle.fitBounds(fitPoints);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, fitKey]);

  return <div ref={containerRef} className="absolute inset-0" data-testid="map-canvas" />;
}
