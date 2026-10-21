import { withOperation } from "@/lib/server/operation-context";
import { getGoogleMapsBrowserKey, getGoogleMapsMapId } from "@/lib/config/runtime";
import { AppShell } from "@/components/shell/AppShell";

export default async function OperationLayout({ children }: { children: React.ReactNode }) {
  // Lidas no servidor, por requisição: a chave não entra no bundle nem no repositório.
  const apiKey = getGoogleMapsBrowserKey();
  const mapConfig = apiKey ? { apiKey, mapId: getGoogleMapsMapId() } : null;
  return withOperation("operation", <AppShell mapConfig={mapConfig}>{children}</AppShell>);
}
