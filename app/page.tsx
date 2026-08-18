"use client";

import Link from "next/link";
import { useSimulation } from "@/components/simulation/SimulationProvider";
import {
  getOverviewMetrics,
  getOperationalAlerts,
  getActiveShipments,
  getExceptionQueue,
  getPlanningQueue,
  getRecentActivity,
} from "@/lib/data/atlas";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NewOrderModal } from "@/components/simulation/NewOrderModal";
import { useState } from "react";

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-blue-opal/20 bg-blue-opal/5 text-blue-opal",
  attention: "border-rowdy-orange/25 bg-rowdy-orange/8 text-rowdy-orange",
  critical: "border-cinnamon/25 bg-cinnamon/8 text-cinnamon",
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diffMs / 3600000);
  if (Math.abs(hours) < 1) return "agora";
  if (hours > 0) return `há ${hours}h`;
  return `em ${Math.abs(hours)}h`;
}

export default function OverviewPage() {
  const { data, isEmpty, loadDemoScenario } = useSimulation();
  const [showNewOrder, setShowNewOrder] = useState(false);
  const metrics = getOverviewMetrics(data);
  const alerts = getOperationalAlerts(data);
  const activeShipments = getActiveShipments(data);
  const exceptions = getExceptionQueue(data);
  const { ordersAwaiting, loadsAwaitingCarrier } = getPlanningQueue(data);
  const recentActivity = getRecentActivity(data);

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader
        section="Atlas Distribuição · Sudeste"
        title="Visão Operacional"
        meta="O que está acontecendo na operação, agora."
      />
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 space-y-8">
        {isEmpty && (
          <div className="rounded-lg border border-dashed border-cosmic-ink/20 bg-white/40 px-6 py-8 text-center">
            <p className="font-display font-semibold text-cosmic-ink mb-1">Nenhuma operação em andamento.</p>
            <p className="text-sm text-cosmic-ink/55 mb-5">
              Comece criando o primeiro pedido — ele entra automaticamente na fila de planejamento.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button type="button"
                onClick={() => setShowNewOrder(true)}
                className="rounded-md bg-blue-opal text-white text-sm font-medium px-4 py-2 hover:bg-blue-opal/90 transition-colors"
              >
                + Novo Pedido
              </button>
              <button type="button"
                onClick={loadDemoScenario}
                className="rounded-md border border-cosmic-ink/15 text-cosmic-ink text-sm font-medium px-4 py-2 hover:bg-cosmic-ink/5 transition-colors"
              >
                Carregar Cenário de Demonstração
              </button>
            </div>
          </div>
        )}

        <Section title="Status da Operação">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Pedidos" value={metrics.orderCount} />
            <MiniStat label="Cargas" value={metrics.loadCount} />
            <MiniStat label="Viagens" value={metrics.shipmentCount} />
            <MiniStat label="Entregas" value={metrics.deliveryCount} />
          </div>
          {alerts.length > 0 && (
            <div className="mt-3 space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-md border px-4 py-2.5 text-sm ${SEVERITY_STYLES[alert.severity]}`}
                >
                  {alert.message}
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Section title="Viagens Ativas" href="/shipments" count={activeShipments.length}>
            <div className="rounded-lg border border-cosmic-ink/10 divide-y divide-cosmic-ink/5 bg-white/60">
              {activeShipments.length === 0 && <EmptyRow text="Nenhuma viagem ativa no momento." />}
              {activeShipments.map(({ shipment, origin, destination, carrierName }) => (
                <Link
                  key={shipment.id}
                  href={`/shipments/${shipment.id}`}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-blue-opal/5 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-display font-medium text-sm text-cosmic-ink">{shipment.id}</p>
                    <p className="text-xs text-cosmic-ink/55 truncate">
                      {origin?.city} → {destination?.city} · {carrierName}
                    </p>
                  </div>
                  <StatusBadge status={shipment.status} />
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Ocorrências em Aberto" count={exceptions.length}>
            <div className="rounded-lg border border-cosmic-ink/10 divide-y divide-cosmic-ink/5 bg-white/60">
              {exceptions.length === 0 && <EmptyRow text="Nenhuma ocorrência em aberto." />}
              {exceptions.map(({ occurrence, shipment }) => (
                <Link
                  key={occurrence.id}
                  href={shipment ? `/shipments/${shipment.id}` : "#"}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-cinnamon/5 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-display font-medium text-sm text-cosmic-ink">{occurrence.type}</p>
                    <p className="text-xs text-cosmic-ink/55 truncate">{shipment?.id}</p>
                  </div>
                  <span className="text-xs font-medium text-cinnamon shrink-0">{occurrence.severity}</span>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Fila de Planejamento" href="/planning" count={ordersAwaiting.length + loadsAwaitingCarrier.length}>
            <div className="rounded-lg border border-cosmic-ink/10 bg-white/60 px-4 py-3 space-y-2">
              <QueueRow label="Pedidos aguardando planejamento" value={ordersAwaiting.length} />
              <QueueRow label="Cargas aguardando contratação" value={loadsAwaitingCarrier.length} />
            </div>
          </Section>

          <Section title="Desempenho">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="OTIF" value={metrics.otifPercent} suffix="%" />
              <MiniStat label="OTD" value={metrics.otdPercent} suffix="%" />
              <MiniStat label="Taxa de Ocupação" value={metrics.occupancyPercent} suffix="%" />
              <MiniStat label="Custo por Entrega" value={metrics.costPerDelivery === null ? null : `R$ ${metrics.costPerDelivery.toLocaleString("pt-BR")}`} />
            </div>
          </Section>
        </div>

        <Section title="Atividade Recente">
          <div className="rounded-lg border border-cosmic-ink/10 divide-y divide-cosmic-ink/5 bg-white/60">
            {recentActivity.length === 0 && <EmptyRow text="Nenhuma atividade recente." />}
            {recentActivity.map((event) => (
              <div key={event.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <p className="text-sm text-cosmic-ink/80">{event.label}</p>
                <p className="text-xs text-cosmic-ink/45 tabular shrink-0">{timeAgo(event.timestamp)}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
      {showNewOrder && <NewOrderModal onClose={() => setShowNewOrder(false)} />}
    </div>
  );
}

function Section({
  title,
  href,
  count,
  children,
}: {
  title: string;
  href?: string;
  count?: number;
  children: React.ReactNode;
}) {
  const heading = (
    <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-cosmic-ink/50 mb-3">
      {title}
      {typeof count === "number" && <span className="ml-2 text-cosmic-ink/30">{count}</span>}
    </h2>
  );
  return (
    <section>
      {href ? (
        <Link href={href} className="inline-block hover:text-blue-opal">
          {heading}
        </Link>
      ) : (
        heading
      )}
      {children}
    </section>
  );
}

function MiniStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number | null;
  suffix?: string;
}) {
  const isEmpty = value === null;
  return (
    <div className="rounded-lg border border-cosmic-ink/10 bg-white/60 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-cosmic-ink/50 mb-1">{label}</p>
      <p className={`font-display font-semibold text-2xl tabular ${isEmpty ? "text-cosmic-ink/30" : "text-cosmic-ink"}`}>
        {isEmpty ? "—" : value}
        {!isEmpty && suffix && <span className="text-base font-medium ml-0.5">{suffix}</span>}
      </p>
    </div>
  );
}

function QueueRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-cosmic-ink/70">{label}</span>
      <span className="font-display font-semibold tabular text-cosmic-ink">{value}</span>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="px-4 py-3 text-sm text-cosmic-ink/45">{text}</div>;
}
