"use client";

import { createContext, useContext, useEffect, useState, ViewTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TooltipProvider, Toaster } from "@/components/ds";
import { useOperation } from "@/components/operation/OperationProvider";
import { NewOrderModal } from "@/components/simulation/NewOrderModal";
import { ShellProvider, useShell } from "./ShellContext";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { CommandMenu } from "./CommandMenu";
import { LiveOperationProvider } from "@/components/live/LiveOperation";

export type MapConfig = { apiKey: string; mapId: string } | null;
const MapConfigContext = createContext<MapConfig>(null);
/** Configuração do Google Maps lida no servidor (chave nunca entra no bundle). */
export const useMapConfig = () => useContext(MapConfigContext);

const COLLAPSE_KEY = "orbita-sidebar-collapsed";

/**
 * App Shell do ÓRBITA 2.0: sidebar (desktop), header com breadcrumb, busca,
 * notificações, criar e perfil; bottom navigation + sheets no mobile;
 * Command Menu global; toasts anunciados; transição de contexto no workspace.
 */
export function AppShell({ children, mapConfig }: { children: ReactNode; mapConfig: MapConfig }) {
  return (
    <MapConfigContext.Provider value={mapConfig}>
      <TooltipProvider>
        <ShellProvider>
          <LiveOperationProvider>
            <ShellFrame>{children}</ShellFrame>
          </LiveOperationProvider>
        </ShellProvider>
      </TooltipProvider>
    </MapConfigContext.Provider>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  const { toasts, dismissToast } = useOperation();
  const { newOrderOpen, setNewOrderOpen } = useShell();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // Preferência por pessoa/dispositivo; lida após a hidratação.
      // Sem preferência salva: recolhido em telas médias (tablet/laptop pequeno), para o mapa respirar.
      const stored = localStorage.getItem(COLLAPSE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(stored === null ? window.innerWidth < 1280 : stored === "1");
    } catch {
      /* sem armazenamento: menu expandido */
    }
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });

  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-fg">
        Pular para o conteúdo
      </a>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main id="conteudo" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[calc(var(--orb-bottom-nav-h)+env(safe-area-inset-bottom))] outline-none md:pb-0">
            {/* Troca de contexto: só quando o caminho muda (filtros na URL não animam a página). */}
            <ViewTransition key={pathname} enter="orb-page-enter" exit="orb-page-exit" default="none">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
            </ViewTransition>
          </main>
        </div>
      </div>
      <BottomNav />
      <CommandMenu />
      {newOrderOpen && <NewOrderModal onClose={() => setNewOrderOpen(false)} />}
      <Toaster toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

/** Toasts da operação para áreas sem o App Shell (Portal do Parceiro). */
export function OperationToaster() {
  const { toasts, dismissToast } = useOperation();
  return <Toaster toasts={toasts} onDismiss={dismissToast} />;
}
