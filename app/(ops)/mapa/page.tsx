import { Suspense } from "react";
import { MapWorkspace } from "@/components/map/MapWorkspace";
import { LoadingState } from "@/components/ds";

export const metadata = { title: "Mapa" };

export default function MapaPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando mapa…" />}>
      <MapWorkspace />
    </Suspense>
  );
}
