import { getOverviewMetrics, getOperationalAlerts } from "@/lib/data/atlas";
import { StatCard } from "@/components/ui/StatCard";

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-blue-opal/20 bg-blue-opal/5 text-blue-opal",
  attention: "border-rowdy-orange/25 bg-rowdy-orange/8 text-rowdy-orange",
  critical: "border-cinnamon/25 bg-cinnamon/8 text-cinnamon",
};

export default function OverviewPage() {
  const metrics = getOverviewMetrics();
  const alerts = getOperationalAlerts();

  return (
    <div className="px-6 py-8 md:px-10 md:py-10 max-w-6xl">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-cosmic-ink/50 mb-1">
          Atlas Distribuição — Sudeste
        </p>
        <h1 className="font-display font-semibold text-2xl md:text-3xl text-cosmic-ink">
          ÓRBITA — Overview
        </h1>
        <p className="text-sm text-cosmic-ink/60 mt-1">
          O que está acontecendo na operação, agora.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Pedidos" value={metrics.orderCount} accent="cosmic" />
        <StatCard label="Cargas" value={metrics.loadCount} accent="cosmic" />
        <StatCard label="Viagens" value={metrics.shipmentCount} accent="cosmic" />
        <StatCard label="Entregas" value={metrics.deliveryCount} accent="cosmic" />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="OTIF" value={metrics.otifPercent} suffix="%" accent="opal" />
        <StatCard label="OTD" value={metrics.otdPercent} suffix="%" accent="opal" />
        <StatCard label="Ocupação" value={metrics.occupancyPercent} suffix="%" accent="opal" />
        <StatCard
          label="Custo / entrega"
          value={`R$ ${metrics.costPerDelivery.toLocaleString("pt-BR")}`}
          accent="opal"
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-cosmic-ink/50 mb-3">
            Situação
          </h2>
          <div className="space-y-2">
            <SituationRow label="Normais" value={metrics.normalCount} dot="bg-emerald-600" />
            <SituationRow label="Em atenção" value={metrics.attentionCount} dot="bg-rowdy-orange" />
            <SituationRow label="Com ocorrência" value={metrics.occurrenceCount} dot="bg-cinnamon" />
          </div>
        </div>

        <div className="md:col-span-2">
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-cosmic-ink/50 mb-3">
            Operational Alerts
          </h2>
          <div className="space-y-2">
            {alerts.length === 0 && (
              <p className="text-sm text-cosmic-ink/50">
                Nenhum alerta operacional no momento.
              </p>
            )}
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-md border px-4 py-3 text-sm ${SEVERITY_STYLES[alert.severity]}`}
              >
                {alert.message}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SituationRow({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-cosmic-ink/10 bg-white/60 px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-cosmic-ink/80">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="font-display font-semibold tabular text-cosmic-ink">{value}</span>
    </div>
  );
}
