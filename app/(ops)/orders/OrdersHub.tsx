"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Inbox as InboxIcon, Plus, Waypoints, ExternalLink, Boxes, Route as RouteIcon, ArrowRight } from "lucide-react";
import { ORDER_STATUSES, type Order, type Solicitation } from "@/lib/domain/types";
import { useOperation } from "@/components/operation/OperationProvider";
import { useUrlParam } from "@/components/live/useUrlState";
import { useShell, useBreadcrumb } from "@/components/shell/ShellContext";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { Button, Combobox, DataTable, Drawer, EmptyState, Field, FilterBar, KeyValue, SearchInput, SegmentedControl, Status, Tabs, Timeline, type Column, type TimelineItem } from "@/components/ds";
import { statusSpec } from "@/lib/ui/status";
import { cn } from "@/lib/ui/cn";

// Pedidos = demanda. Duas visões do mesmo trabalho: os pedidos (Ordens de
// Serviço) e a Caixa de entrada (solicitações do Portal do Parceiro, antes
// de virarem pedido). Selecionar → painel com contexto e a próxima ação.

const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00` : iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const dateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

type Aba = "pedidos" | "entrada";

export function OrdersHub() {
  const { data, can } = useOperation();
  const router = useRouter();
  const { setNewOrderOpen } = useShell();
  const [abaRaw, setAba] = useUrlParam("aba");
  const [pedido, setPedido] = useUrlParam("pedido");
  const [solicitacao, setSolicitacao] = useUrlParam("solicitacao");
  const [filtro, setFiltro] = useUrlParam("filtro");
  const [q, setQ] = useUrlParam("q");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const aba: Aba = abaRaw === "entrada" ? "entrada" : "pedidos";
  const inboxOpen = data.solicitations.filter((s) => s.status === "Solicitada" || s.status === "Em análise");

  const orders = useMemo(() => {
    let list = [...data.orders].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
    if (filtro) list = list.filter((o) => o.status === filtro);
    if (q) {
      const words = norm(q).split(/\s+/).filter(Boolean);
      list = list.filter((o) => {
        const hay = norm([o.id, data.customers.find((c) => c.id === o.customerId)?.name, data.locations.find((l) => l.id === o.destinationId)?.city, data.locations.find((l) => l.id === o.destinationId)?.name].filter(Boolean).join(" "));
        return words.every((w) => hay.includes(w));
      });
    }
    return list;
  }, [data.orders, data.customers, data.locations, filtro, q]);

  const statusOptions = [
    { value: "", label: "Todos", tone: "all" as const, count: data.orders.length },
    ...ORDER_STATUSES.map((s) => ({ value: s, label: statusSpec("order", s).label, tone: statusSpec("order", s).tone, count: data.orders.filter((o) => o.status === s).length })).filter((o) => o.count > 0 || o.value === filtro),
  ];
  const selectedAwaiting = [...selected].filter((id) => data.orders.find((o) => o.id === id)?.status === "Aguardando planejamento");
  const openOrder = data.orders.find((o) => o.id === pedido) ?? null;
  const openSol = data.solicitations.find((s) => s.id === solicitacao) ?? null;
  useBreadcrumb(openOrder?.id ?? openSol?.id ?? (aba === "entrada" ? "Caixa de entrada" : null));

  const columns: Column<Order>[] = [
    { id: "id", header: "Pedido", cell: (o) => <span className="orb-data font-medium">{o.id}</span>, sortValue: (o) => o.id },
    { id: "cliente", header: "Cliente", cell: (o) => <span className="block max-w-52 truncate">{data.customers.find((c) => c.id === o.customerId)?.name ?? "—"}</span>, sortValue: (o) => data.customers.find((c) => c.id === o.customerId)?.name ?? "" },
    {
      id: "trecho",
      header: "Origem → destino",
      cell: (o) => (
        <span className="block max-w-60 truncate">
          {data.locations.find((l) => l.id === o.originId)?.city} → {data.locations.find((l) => l.id === o.destinationId)?.city}
        </span>
      ),
      hideBelow: "lg",
    },
    { id: "peso", header: "Peso", align: "right", cell: (o) => `${o.totalWeightKg.toLocaleString("pt-BR")} kg`, sortValue: (o) => o.totalWeightKg, mono: true, hideBelow: "md" },
    { id: "prazo", header: "Prazo", cell: (o) => day(o.dueDate), sortValue: (o) => o.dueDate, mono: true },
    {
      id: "prioridade",
      header: "Prioridade",
      cell: (o) => <span className={cn("text-body-sm", o.priority === "Urgente" ? "font-semibold text-danger-fg" : o.priority === "Alta" ? "font-medium text-warning-fg" : "text-fg-muted")}>{o.priority}</span>,
      sortValue: (o) => ({ Urgente: 0, Alta: 1, Normal: 2 })[o.priority],
      hideBelow: "xl",
    },
    { id: "situacao", header: "Situação", cell: (o) => <Status entity="order" value={o.status} size="sm" />, sortValue: (o) => o.status },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceHeader
        title="Pedidos"
        meta={
          <span className="tabular">
            {data.orders.length} pedidos · {data.orders.filter((o) => o.status === "Aguardando planejamento").length} aguardando planejamento · {inboxOpen.length} solicitação(ões) na caixa de entrada
          </span>
        }
        actions={
          can("orders:create") && (
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setNewOrderOpen(true)}>
              Novo pedido
            </Button>
          )
        }
      >
        <Tabs
          label="Visão"
          value={aba}
          onChange={(v) => setAba(v === "pedidos" ? null : v)}
          listClassName="border-b-0"
          tabs={[
            { value: "pedidos", label: "Pedidos", count: data.orders.length },
            { value: "entrada", label: "Caixa de entrada", count: inboxOpen.length, attention: inboxOpen.length > 0 },
          ]}
        />
      </WorkspaceHeader>

      {aba === "pedidos" ? (
        <>
          <div className="flex flex-col gap-2 border-b border-line-subtle bg-canvas px-4 py-2.5 md:flex-row md:items-center md:px-6">
            <FilterBar label="Situação do pedido" value={filtro ?? ""} onChange={(v) => setFiltro(v || null)} options={statusOptions} className="min-w-0 flex-1" />
            <SearchInput label="Buscar pedido" value={q ?? ""} onChange={(v) => setQ(v || null)} placeholder="Pedido, cliente, destino" className="md:w-64" />
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-3 border-b border-line-subtle bg-surface-selected px-4 py-2 text-body-sm animate-orb-fade-in md:px-6" role="status">
              <span className="tabular font-medium text-fg">{selected.size} selecionado(s)</span>
              {selectedAwaiting.length > 0 && can("planning:consolidate") && (
                <Button size="sm" variant="primary" icon={<Waypoints className="size-4" aria-hidden />} onClick={() => router.push(`/planning?pedidos=${selectedAwaiting.join(",")}`)}>
                  Planejar {selectedAwaiting.length}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="ml-auto">
                Limpar
              </Button>
            </div>
          )}
          <div className="min-h-0 flex-1 bg-surface">
            <DataTable
              label="Pedidos"
              rows={orders}
              rowKey={(o) => o.id}
              columns={columns}
              activeKey={pedido}
              onRowClick={(o) => setPedido(o.id)}
              selectable={can("planning:consolidate")}
              selected={selected}
              onSelectedChange={setSelected}
              className="h-full"
              empty={
                <EmptyState
                  icon={<ClipboardList />}
                  title={data.orders.length ? "Nenhum pedido neste filtro." : "Nenhum pedido ainda."}
                  description={data.orders.length ? "Ajuste o filtro ou a busca." : "Crie o primeiro pedido ou converta uma solicitação da caixa de entrada."}
                  action={can("orders:create") && !data.orders.length ? <Button variant="primary" onClick={() => setNewOrderOpen(true)}>Novo pedido</Button> : undefined}
                />
              }
              card={(o) => (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <span className="orb-data text-body-sm font-medium text-fg">{o.id}</span>
                      {o.priority !== "Normal" && <span className={cn("text-caption font-semibold", o.priority === "Urgente" ? "text-danger-fg" : "text-warning-fg")}>{o.priority}</span>}
                    </p>
                    <p className="truncate text-caption text-fg-muted">
                      {data.customers.find((c) => c.id === o.customerId)?.name} · até <span className="orb-data">{day(o.dueDate)}</span>
                    </p>
                  </div>
                  <Status entity="order" value={o.status} size="sm" />
                </div>
              )}
            />
          </div>
        </>
      ) : (
        <InboxView onOpen={setSolicitacao} activeId={solicitacao} />
      )}

      <Drawer
        open={!!openOrder}
        onOpenChange={(o) => !o && setPedido(null)}
        title={<span className="orb-data">{openOrder?.id}</span>}
        status={openOrder ? <Status entity="order" value={openOrder.status} size="sm" /> : null}
        subtitle={openOrder ? data.customers.find((c) => c.id === openOrder.customerId)?.name : null}
        footer={openOrder ? <OrderActions order={openOrder} /> : null}
      >
        {openOrder && <OrderDetail order={openOrder} />}
      </Drawer>

      <Drawer
        open={!!openSol}
        onOpenChange={(o) => !o && setSolicitacao(null)}
        title={<span className="orb-data">{openSol?.id}</span>}
        status={openSol ? <Status entity="solicitation" value={openSol.status} size="sm" /> : null}
        subtitle={openSol ? (data.partnerCompanies.find((p) => p.id === openSol.partnerCompanyId)?.tradeName ?? data.partnerCompanies.find((p) => p.id === openSol.partnerCompanyId)?.legalName) : null}
      >
        {openSol && (
          <SolicitationDetail
            sol={openSol}
            onConverted={(orderId) => {
              setSolicitacao(null);
              router.replace(`/orders?pedido=${orderId}`, { scroll: false });
            }}
          />
        )}
      </Drawer>
    </div>
  );
}

/* ------------------------------------------------------------------ Pedido */

const LIFECYCLE = ["Criado", "Planejado", "Carga", "Em transporte", "Entregue"] as const;

function OrderDetail({ order }: { order: Order }) {
  const { data } = useOperation();
  const load = data.loads.find((l) => l.orderIds.includes(order.id));
  const shipment = load?.shipmentId ? data.shipments.find((s) => s.id === load.shipmentId) : undefined;
  const origin = data.locations.find((l) => l.id === order.originId);
  const dest = data.locations.find((l) => l.id === order.destinationId);
  const stage = order.status === "Entregue" ? 4 : shipment && shipment.status !== "Planned" ? 3 : load ? 2 : order.status === "Planejado" ? 1 : 0;
  const events = data.orderEvents.filter((e) => e.orderId === order.id).sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const steps: TimelineItem[] = LIFECYCLE.map((label, i) => ({
    id: label,
    title: label,
    state: i < stage ? "done" : i === stage ? (order.status === "Com ocorrência" ? "issue" : order.status === "Devolvido" ? "late" : "active") : "pending",
    marker: i + 1,
    meta: i === 2 && load ? <Link href={`/loads?carga=${load.id}`} className="orb-data hover:underline">{load.id}</Link> : i === 3 && shipment ? <Link href={`/shipments/${shipment.id}`} className="orb-data hover:underline">{shipment.routeCode ?? shipment.id}</Link> : undefined,
  }));

  return (
    <div className="space-y-5 px-5 py-4">
      <div className="flex items-center gap-2 text-body-sm text-fg">
        <span className="truncate">{origin?.name}</span>
        <ArrowRight className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
        <span className="truncate">
          {dest?.name}, {dest?.city}
        </span>
      </div>
      <section aria-label="Ciclo de vida">
        <Timeline label="Ciclo de vida do pedido" items={steps} />
      </section>
      <dl className="grid grid-cols-2 gap-3 border-t border-line-subtle pt-4">
        <KeyValue label="Tipo" value={order.operationType} />
        <KeyValue label="Prioridade" value={order.priority} />
        <KeyValue label="Coleta" value={<span className="orb-data">{day(order.pickupDate)}{order.pickupWindowStart ? ` · ${order.pickupWindowStart}–${order.pickupWindowEnd}` : ""}</span>} />
        <KeyValue label="Entrega até" value={<span className="orb-data">{day(order.dueDate)}{order.deliveryWindowStart ? ` · ${order.deliveryWindowStart}–${order.deliveryWindowEnd}` : ""}</span>} />
        <KeyValue label="Peso" value={`${order.totalWeightKg.toLocaleString("pt-BR")} kg`} mono />
        <KeyValue label="Volume" value={`${order.totalVolumeM3.toLocaleString("pt-BR")} m³`} mono />
        {order.destinationContactName && <KeyValue label="Contato" value={`${order.destinationContactName}${order.destinationContactPhone ? ` · ${order.destinationContactPhone}` : ""}`} />}
        {order.requestedBy && <KeyValue label="Solicitado por" value={order.requestedBy} />}
      </dl>
      <section aria-label="Itens" className="border-t border-line-subtle pt-4">
        <p className="mb-2 text-h3 text-fg">Itens</p>
        <ul className="divide-y divide-line-subtle rounded-md border border-line-subtle">
          {order.items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 px-3 py-2 text-body-sm">
              <span className="min-w-0 truncate text-fg">{it.productId ? data.products.find((p) => p.id === it.productId)?.name : it.description}</span>
              <span className="orb-data shrink-0 text-fg-muted">
                {it.quantity} × {it.unitWeightKg.toLocaleString("pt-BR")} kg
              </span>
            </li>
          ))}
        </ul>
        {order.cargoCharacteristics.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-1.5">
            {order.cargoCharacteristics.map((c) => (
              <span key={c} className="rounded-xs border border-line-subtle px-1.5 text-caption text-fg-muted">
                {c}
              </span>
            ))}
            {order.temperatureMin !== undefined && <span className="orb-data rounded-xs border border-info-line bg-info-subtle px-1.5 text-caption text-info-fg">{order.temperatureMin}°C a {order.temperatureMax}°C</span>}
          </p>
        )}
      </section>
      {events.length > 0 && (
        <section aria-label="Histórico" className="border-t border-line-subtle pt-4">
          <p className="mb-2 text-h3 text-fg">Histórico</p>
          <ol className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="text-body-sm">
                <span className="orb-data block text-caption text-fg-subtle">{dateTime(e.timestamp)}</span>
                <span className="text-fg">{e.message}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function OrderActions({ order }: { order: Order }) {
  const { data, can } = useOperation();
  const load = data.loads.find((l) => l.orderIds.includes(order.id));
  if (order.status === "Aguardando planejamento" && can("planning:consolidate"))
    return (
      <Button variant="primary" asChild>
        <Link href={`/planning?order=${order.id}`}>
          <Waypoints className="size-4" aria-hidden /> Planejar transporte
        </Link>
      </Button>
    );
  if (load?.shipmentId)
    return (
      <>
        <Button variant="primary" asChild>
          <Link href={`/shipments/${load.shipmentId}`}>
            <RouteIcon className="size-4" aria-hidden /> Ver viagem
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/loads?carga=${load.id}`}>
            <Boxes className="size-4" aria-hidden /> Ver carga
          </Link>
        </Button>
      </>
    );
  if (load)
    return (
      <Button variant="primary" asChild>
        <Link href={`/loads?carga=${load.id}`}>
          <Boxes className="size-4" aria-hidden /> Contratar transporte
        </Link>
      </Button>
    );
  return null;
}

/* ------------------------------------------------------------------ Caixa de entrada */

function InboxView({ onOpen, activeId }: { onOpen: (id: string) => void; activeId: string | null }) {
  const { data } = useOperation();
  const [show, setShow] = useState<"abertas" | "convertidas">("abertas");
  const list = data.solicitations
    .filter((s) => (show === "abertas" ? s.status !== "Convertida em Pedido" && s.status !== "Recusada" : s.status === "Convertida em Pedido"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const partner = (id: string) => data.partnerCompanies.find((p) => p.id === id);
  const loc = (id: string) => data.locations.find((l) => l.id === id);
  const columns: Column<Solicitation>[] = [
    { id: "id", header: "Solicitação", cell: (s) => <span className="orb-data font-medium">{s.id}</span>, sortValue: (s) => s.id },
    { id: "parceiro", header: "Parceiro", cell: (s) => partner(s.partnerCompanyId)?.tradeName || partner(s.partnerCompanyId)?.legalName || "—" },
    { id: "trecho", header: "Origem → destino", cell: (s) => `${loc(s.originId)?.city} → ${loc(s.destinationId)?.city}`, hideBelow: "lg" },
    { id: "carga", header: "Carga", cell: (s) => <span className="block max-w-56 truncate">{s.productDescription} · {s.totalWeightKg.toLocaleString("pt-BR")} kg</span>, hideBelow: "md" },
    { id: "coleta", header: "Coleta", cell: (s) => day(s.pickupDate), mono: true, sortValue: (s) => s.pickupDate },
    { id: "recebida", header: "Recebida", cell: (s) => dateTime(s.createdAt), mono: true, sortValue: (s) => s.createdAt, hideBelow: "xl" },
    { id: "situacao", header: "Situação", cell: (s) => (s.orderId ? <span className="flex items-center gap-2"><Status entity="solicitation" value={s.status} size="sm" /><span className="orb-data text-caption text-fg-muted">{s.orderId}</span></span> : <Status entity="solicitation" value={s.status} size="sm" />) },
  ];
  return (
    <>
      <div className="flex items-center gap-2 border-b border-line-subtle bg-canvas px-4 py-2.5 md:px-6">
        <SegmentedControl label="Solicitações" size="sm" value={show} onChange={setShow} options={[{ value: "abertas", label: "Abertas" }, { value: "convertidas", label: "Convertidas" }]} />
        <p className="ml-auto hidden text-caption text-fg-muted sm:block">Solicitações chegam pelo Portal do Parceiro e viram pedido após análise.</p>
      </div>
      <div className="min-h-0 flex-1 bg-surface">
        <DataTable
          label="Caixa de entrada"
          rows={list}
          rowKey={(s) => s.id}
          columns={columns}
          activeKey={activeId}
          onRowClick={(s) => onOpen(s.id)}
          className="h-full"
          empty={<EmptyState icon={<InboxIcon />} title={show === "abertas" ? "Caixa de entrada vazia." : "Nenhuma solicitação convertida ainda."} description="Parceiros enviam solicitações pelo Portal (/portal) com o código de acesso." />}
          card={(s) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="orb-data text-body-sm font-medium text-fg">{s.id}</p>
                <p className="truncate text-caption text-fg-muted">
                  {partner(s.partnerCompanyId)?.tradeName ?? partner(s.partnerCompanyId)?.legalName} · {s.totalWeightKg.toLocaleString("pt-BR")} kg
                </p>
              </div>
              <Status entity="solicitation" value={s.status} size="sm" />
            </div>
          )}
        />
      </div>
    </>
  );
}

function SolicitationDetail({ sol, onConverted }: { sol: Solicitation; onConverted: (orderId: string) => void }) {
  const { data, can, convertSolicitationToOrder } = useOperation();
  const [customerId, setCustomerId] = useState<string | null>(data.customers[0]?.id ?? null);
  const [priority, setPriority] = useState<"Normal" | "Alta" | "Urgente">("Normal");
  const [busy, setBusy] = useState(false);
  const loc = (id: string) => data.locations.find((l) => l.id === id);
  const convertible = sol.status !== "Convertida em Pedido" && sol.status !== "Recusada";

  const convert = async () => {
    if (!customerId) return;
    setBusy(true);
    const outcome = await convertSolicitationToOrder(sol.id, customerId, priority);
    setBusy(false);
    if (outcome.ok) {
      const created = outcome.data.solicitations.find((s) => s.id === sol.id)?.orderId;
      if (created) onConverted(created);
    }
  };

  return (
    <div className="space-y-5 px-5 py-4">
      <dl className="grid grid-cols-2 gap-3">
        <KeyValue label="Tipo" value={sol.operationType} />
        <KeyValue label="Solicitado por" value={sol.requestedBy ?? "—"} />
        <KeyValue label="Coleta" value={<span className="orb-data">{day(sol.pickupDate)}{sol.pickupWindowStart ? ` · ${sol.pickupWindowStart}–${sol.pickupWindowEnd}` : ""}</span>} />
        <KeyValue label="Entrega" value={<span className="orb-data">{day(sol.deliveryDate)}{sol.deliveryWindowStart ? ` · ${sol.deliveryWindowStart}–${sol.deliveryWindowEnd}` : ""}</span>} />
        <KeyValue label="Origem" value={loc(sol.originId)?.name} />
        <KeyValue label="Destino" value={`${loc(sol.destinationId)?.name}, ${loc(sol.destinationId)?.city}`} />
        <KeyValue label="Carga" value={`${sol.quantity} ${sol.unit ?? "un."} · ${sol.productDescription}`} className="col-span-2" />
        <KeyValue label="Peso" value={`${sol.totalWeightKg.toLocaleString("pt-BR")} kg`} mono />
        <KeyValue label="Volume" value={sol.totalVolumeM3 ? `${sol.totalVolumeM3} m³` : "—"} mono />
        {(sol.nfeNumber || sol.romaneioNumber) && <KeyValue label="Documentos" value={[sol.nfeNumber && `NF-e ${sol.nfeNumber}`, sol.romaneioNumber && `Romaneio ${sol.romaneioNumber}`].filter(Boolean).join(" · ")} className="col-span-2" />}
        {sol.notes && <KeyValue label="Observações" value={sol.notes} className="col-span-2" />}
      </dl>
      {sol.orderId && (
        <Button asChild>
          <Link href={`/orders?pedido=${sol.orderId}`}>
            <ExternalLink className="size-4" aria-hidden /> Abrir pedido {sol.orderId}
          </Link>
        </Button>
      )}
      {convertible && can("solicitations:convert") && (
        <section aria-label="Converter em pedido" className="space-y-3 rounded-md border border-line-subtle bg-canvas p-4">
          <p className="text-h3 text-fg">Converter em pedido</p>
          <Field label="Cliente (destinatário)" error={data.customers.length === 0 ? "Cadastre ao menos um cliente antes de converter." : undefined}>
            <Combobox label="Cliente" value={customerId} onChange={setCustomerId} placeholder="Buscar cliente" options={data.customers.map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
          <Field label="Prioridade">
            <SegmentedControl label="Prioridade" value={priority} onChange={setPriority} options={[{ value: "Normal", label: "Normal" }, { value: "Alta", label: "Alta" }, { value: "Urgente", label: "Urgente" }]} className="w-full" />
          </Field>
          <Button variant="primary" className="w-full" loading={busy} disabled={!customerId} onClick={convert}>
            Converter em pedido
          </Button>
          <p className="text-caption text-fg-subtle">O pedido entra na fila de planejamento com os dados da solicitação.</p>
        </section>
      )}
    </div>
  );
}
