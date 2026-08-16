import { getOperationData } from "@/lib/data/atlas";
import { StatusBadge } from "@/components/ui/StatusBadge";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function OrdersPage() {
  const data = getOperationData();
  const locationById = new Map(data.locations.map((l) => [l.id, l]));

  const orders = [...data.orders].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  return (
    <div className="px-6 py-8 md:px-10 md:py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-cosmic-ink/50 mb-1">
          Operations
        </p>
        <h1 className="font-display font-semibold text-2xl md:text-3xl text-cosmic-ink">
          ÓRBITA — Orders
        </h1>
        <p className="text-sm text-cosmic-ink/60 mt-1">{orders.length} pedidos na operação</p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-cosmic-ink/10 bg-white/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-cosmic-ink/50 border-b border-cosmic-ink/10">
              <th className="px-4 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Rota</th>
              <th className="px-4 py-3 font-medium">Peso</th>
              <th className="px-4 py-3 font-medium">Prazo</th>
              <th className="px-4 py-3 font-medium">Prioridade</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const origin = locationById.get(order.originId);
              const destination = locationById.get(order.destinationId);
              return (
                <tr
                  key={order.id}
                  className="border-b border-cosmic-ink/5 last:border-0 hover:bg-blue-opal/5 transition-colors"
                >
                  <td className="px-4 py-3 font-display font-medium text-cosmic-ink whitespace-nowrap">
                    {order.id}
                  </td>
                  <td className="px-4 py-3 text-cosmic-ink/80 whitespace-nowrap">
                    {origin?.city} → {destination?.city}
                  </td>
                  <td className="px-4 py-3 tabular text-cosmic-ink/80 whitespace-nowrap">
                    {order.totalWeightKg.toLocaleString("pt-BR")} kg
                  </td>
                  <td className="px-4 py-3 tabular text-cosmic-ink/80 whitespace-nowrap">
                    {formatDate(order.dueDate)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <PriorityTag priority={order.priority} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={order.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriorityTag({ priority }: { priority: "Normal" | "Alta" | "Urgente" }) {
  const style =
    priority === "Urgente"
      ? "text-cinnamon"
      : priority === "Alta"
      ? "text-rowdy-orange"
      : "text-cosmic-ink/50";
  return <span className={`text-xs font-medium ${style}`}>{priority}</span>;
}
