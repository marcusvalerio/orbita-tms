import { Suspense } from "react";
import { getGoogleMapsBrowserKey, getGoogleMapsMapId } from "@/lib/config/runtime";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { MapWorkspace } from "@/components/map/MapWorkspace";

export const metadata = { title: "Mapa Operacional · ÓRBITA TMS" };

export default function MapaPage() {
  // Lidas no servidor, por requisição: a chave não entra no bundle nem no repositório.
  const apiKey = getGoogleMapsBrowserKey();
  const mapConfig = apiKey ? { apiKey, mapId: getGoogleMapsMapId() } : null;

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader section="Operação" title="Mapa Operacional" meta="Rotas, paradas e veículos em tempo (simulado) real." />
      <Suspense fallback={null}>
        <MapWorkspace mapConfig={mapConfig} />
      </Suspense>
    </div>
  );
}
