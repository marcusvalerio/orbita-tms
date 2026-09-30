import { withOperation } from "@/lib/server/operation-context";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/simulation/TopBar";
import { ToastStack } from "@/components/simulation/ToastStack";

export default async function OperationLayout({ children }: { children: React.ReactNode }) {
  return withOperation(
    "operation",
    <>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 min-w-0 h-screen flex flex-col">
          <TopBar />
          <main id="conteudo" className="flex-1 min-w-0 overflow-hidden flex flex-col">
            {children}
          </main>
        </div>
      </div>
      <ToastStack />
    </>
  );
}
