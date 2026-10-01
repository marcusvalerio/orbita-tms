"use client";

import Link from "next/link";
import { useState } from "react";
import { Database, RotateCcw, ShieldCheck, Palette } from "lucide-react";
import { useOperation } from "@/components/operation/OperationProvider";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { Button, ConfirmDialog, KeyValue } from "@/components/ds";

export default function PreferenciasPage() {
  const { resetSimulation, loadDemoScenario, isEmpty, mode, actor, roleLabel, companyName } = useOperation();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceHeader title="Preferências" meta="Empresa, conta e dados de demonstração." />
      <div className="orb-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl divide-y divide-line-subtle px-4 py-2 md:px-6">
          <Row stacked icon={<ShieldCheck />} title="Conta e acesso" description={mode === "production" ? "Operação real: dados no banco da empresa, cada ação registrada na trilha de auditoria." : "Modo Demo: operação no navegador, sem banco nem login."}>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <KeyValue label="Empresa" value={companyName} />
              <KeyValue label="Pessoa" value={actor.name} />
              <KeyValue label="Papel" value={roleLabel} />
              {mode === "production" && <KeyValue label="E-mail" value={actor.email} className="col-span-2" />}
            </dl>
          </Row>

          {mode === "demo" && (
            <>
              <Row
                icon={<Database />}
                title="Cenário de demonstração"
                description={`Carrega a operação fictícia da Atlas Distribuição — pedidos, cargas, viagens e ocorrências em andamento — para explorar o sistema.${isEmpty ? "" : " Substitui a operação atual."}`}
              >
                <Button onClick={() => setConfirmDemo(true)}>Carregar cenário de demonstração</Button>
              </Row>
              <Row icon={<RotateCcw />} title="Reiniciar simulação" description="Apaga pedidos, cargas, viagens, entregas, ocorrências e documentos desta sessão e zera os identificadores (o próximo pedido volta a ser PED-00001).">
                <Button variant="danger" onClick={() => setConfirmReset(true)}>
                  Reiniciar simulação
                </Button>
              </Row>
            </>
          )}

          <Row icon={<Palette />} title="Design System" description="Catálogo vivo de componentes, cores e estados do ÓRBITA 2.0.">
            <Button asChild>
              <Link href="/design-system">Abrir catálogo</Link>
            </Button>
          </Row>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reiniciar simulação?"
        description="Isso apagará todas as informações desta simulação e restaurará a operação para o estado inicial."
        confirmLabel="Reiniciar simulação"
        tone="danger"
        onConfirm={() => resetSimulation?.()}
      />
      <ConfirmDialog
        open={confirmDemo}
        onOpenChange={setConfirmDemo}
        title="Carregar cenário de demonstração?"
        description="Isso substituirá a operação atual pelos dados fictícios da Atlas Distribuição."
        confirmLabel="Carregar cenário"
        onConfirm={() => loadDemoScenario?.()}
      />
    </div>
  );
}

function Row({ icon, title, description, children, stacked }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode; stacked?: boolean }) {
  return (
    <section className={stacked ? "grid gap-3 py-5" : "grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"}>
      <div className="flex gap-3">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-sunken text-fg-muted [&_svg]:size-4">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-h3 text-fg">{title}</h2>
          <p className="text-body-sm text-fg-muted">{description}</p>
        </div>
      </div>
      <div className={stacked ? "pl-11" : "pl-11 sm:pl-0"}>{children}</div>
    </section>
  );
}
