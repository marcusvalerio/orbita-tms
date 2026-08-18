"use client";

import { useState } from "react";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";

export default function PreferenciasPage() {
  const { resetSimulation, loadDemoScenario, isEmpty } = useSimulation();
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showConfirmDemo, setShowConfirmDemo] = useState(false);

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader section="Configurações" title="Preferências" />
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 max-w-xl space-y-4">
        <section className="rounded-lg border border-cosmic-ink/10 bg-white/60 px-5 py-4">
          <h2 className="font-display font-semibold text-sm text-cosmic-ink mb-1">Cenário de Demonstração</h2>
          <p className="text-sm text-cosmic-ink/60 mb-4">
            Carrega a operação fictícia da Atlas Distribuição — pedidos, cargas, viagens e ocorrências já em
            andamento — para você explorar o sistema sem precisar construir do zero.
            {!isEmpty && " Isso substitui a operação atual."}
          </p>
          <button type="button"
            onClick={() => setShowConfirmDemo(true)}
            className="rounded-md border border-blue-opal/30 text-blue-opal text-sm font-medium px-4 py-2 hover:bg-blue-opal/5 transition-colors"
          >
            Carregar Cenário de Demonstração
          </button>
        </section>

        <section className="rounded-lg border border-cinnamon/25 bg-cinnamon/5 px-5 py-4">
          <h2 className="font-display font-semibold text-sm text-cosmic-ink mb-1">Reiniciar Simulação</h2>
          <p className="text-sm text-cosmic-ink/60 mb-4">
            Apaga todos os pedidos, cargas, viagens, entregas, ocorrências e documentos criados nesta sessão,
            zera os contadores de identificadores (o próximo pedido volta a ser PED-00001) e restaura a operação
            para o estado inicial vazio.
          </p>
          <button type="button"
            onClick={() => setShowConfirmReset(true)}
            className="rounded-md border border-cinnamon/40 text-cinnamon text-sm font-medium px-4 py-2 hover:bg-cinnamon/10 transition-colors"
          >
            Reiniciar Simulação
          </button>
        </section>
      </div>

      {showConfirmReset && (
        <ConfirmDialog
          title="Reiniciar Simulação"
          message="Isso apagará todas as informações desta simulação e restaurará a operação para o estado inicial."
          confirmLabel="Reiniciar Simulação"
          confirmClassName="bg-cinnamon hover:bg-cinnamon/90"
          onCancel={() => setShowConfirmReset(false)}
          onConfirm={() => {
            resetSimulation();
            setShowConfirmReset(false);
          }}
        />
      )}

      {showConfirmDemo && (
        <ConfirmDialog
          title="Carregar Cenário de Demonstração"
          message="Isso substituirá a operação atual pelos dados fictícios da Atlas Distribuição."
          confirmLabel="Carregar Cenário"
          confirmClassName="bg-blue-opal hover:bg-blue-opal/90"
          onCancel={() => setShowConfirmDemo(false)}
          onConfirm={() => {
            loadDemoScenario();
            setShowConfirmDemo(false);
          }}
        />
      )}
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmClassName,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClassName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-cosmic-ink/40 px-4" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg bg-white shadow-xl px-6 py-5">
        <h2 className="font-display font-semibold text-lg text-cosmic-ink mb-2">{title}</h2>
        <p className="text-sm text-cosmic-ink/60 mb-5">{message}</p>
        <div className="flex gap-2">
          <button type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-cosmic-ink/15 text-cosmic-ink text-sm font-medium py-2.5 hover:bg-cosmic-ink/5 transition-colors"
          >
            Cancelar
          </button>
          <button type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-md text-white text-sm font-medium py-2.5 transition-colors ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
