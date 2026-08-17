"use client";

import { useState } from "react";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";

export default function PreferenciasPage() {
  const { resetSimulation } = useSimulation();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirm = () => {
    resetSimulation();
    setShowConfirm(false);
  };

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader section="Configurações" title="Preferências" />
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 max-w-xl">
        <section className="rounded-lg border border-cinnamon/25 bg-cinnamon/5 px-5 py-4">
          <h2 className="font-display font-semibold text-sm text-cosmic-ink mb-1">Reiniciar Simulação</h2>
          <p className="text-sm text-cosmic-ink/60 mb-4">
            Restaura a operação da Atlas Distribuição para os dados iniciais e apaga todas as alterações feitas
            nesta sessão (pedidos, cargas, viagens, ocorrências e entregas criados ou modificados por você).
          </p>
          <button
            onClick={() => setShowConfirm(true)}
            className="rounded-md border border-cinnamon/40 text-cinnamon text-sm font-medium px-4 py-2 hover:bg-cinnamon/10 transition-colors"
          >
            Reiniciar Simulação
          </button>
        </section>
      </div>

      {showConfirm && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-cosmic-ink/40 px-4"
          onClick={() => setShowConfirm(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg bg-white shadow-xl px-6 py-5">
            <h2 className="font-display font-semibold text-lg text-cosmic-ink mb-2">Reiniciar Simulação</h2>
            <p className="text-sm text-cosmic-ink/60 mb-5">
              Isso restaurará a operação para os dados iniciais e apagará todas as alterações realizadas nesta
              sessão.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-md border border-cosmic-ink/15 text-cosmic-ink text-sm font-medium py-2.5 hover:bg-cosmic-ink/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 rounded-md bg-cinnamon text-white text-sm font-medium py-2.5 hover:bg-cinnamon/90 transition-colors"
              >
                Reiniciar Simulação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
