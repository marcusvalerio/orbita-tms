"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronDown, Package, Waypoints } from "lucide-react";
import { useOperation } from "@/components/operation/OperationProvider";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { Button, EmptyState, SearchInput, MetricGrid } from "@/components/ds";
import { TenderPanel, tenderExtras, type TenderChoice } from "@/components/patterns/TenderPanel";
import { analyzePlanning, explainPlan, type PlanOption } from "@/lib/planning/plans";
import { cn } from "@/lib/ui/cn";

// Planejamento como um fluxo, não três colunas vazias:
//   1 Demanda (pedidos compatíveis, agrupados por CD) →
//   2 Alternativas (3 planos explicáveis, lado a lado) →
//   3 Contratação (custo, transportadora, veículo, motorista) → viagem criada.

type Step = "demanda" | "alternativas" | "contratacao";
const STEPS: { id: Step; label: string }[] = [
  { id: "demanda", label: "Demanda" },
  { id: "alternativas", label: "Alternativas" },
  { id: "contratacao", label: "Contratação" },
];

const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const fmtDay = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00` : iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export function PlanningFlow() {
  const { data, createLoad, createShipment, can } = useOperation();
  const router = useRouter();
  const params = useSearchParams();
  const pre = [params.get("order"), ...(params.get("pedidos")?.split(",") ?? [])].filter(Boolean) as string[];

  const awaiting = useMemo(() => data.orders.filter((o) => o.status === "Aguardando planejamento"), [data.orders]);
  const [selected, setSelected] = useState<string[]>(() => {
    // Pré-seleção vinda de Pedidos: só pedidos aguardando e da mesma origem do primeiro.
    const valid = pre.map((id) => awaiting.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => !!o);
    return valid.filter((o) => o.originId === valid[0]?.originId).map((o) => o.id);
  });
  const [step, setStep] = useState<Step>("demanda");
  const [planKey, setPlanKey] = useState<PlanOption["key"] | null>(null);
  const [why, setWhy] = useState<PlanOption["key"] | null>(null);
  const [choice, setChoice] = useState<TenderChoice>({ optionId: null });
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const selectedOrders = awaiting.filter((o) => selected.includes(o.id));
  const reference = selectedOrders[0];
  const analysis = useMemo(() => (step !== "demanda" && selectedOrders.length ? analyzePlanning(selectedOrders, data.carriers, data.vehicles) : null), [step, selectedOrders, data.carriers, data.vehicles]);
  const plan = analysis?.plans.find((p) => p.key === planKey) ?? null;
  const loc = (id: string) => data.locations.find((l) => l.id === id);
  const customer = (id: string) => data.customers.find((c) => c.id === id);

  const groups = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const list = awaiting.filter((o) => {
      if (!words.length) return true;
      const hay = norm([o.id, customer(o.customerId)?.name, loc(o.destinationId)?.name, loc(o.destinationId)?.city].filter(Boolean).join(" "));
      return words.every((w) => hay.includes(w));
    });
    const by = new Map<string, typeof list>();
    for (const o of list) by.set(o.originId, [...(by.get(o.originId) ?? []), o]);
    return [...by.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaiting, q, data.customers, data.locations]);

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const totals = { weight: selectedOrders.reduce((s, o) => s + o.totalWeightKg, 0), volume: Math.round(selectedOrders.reduce((s, o) => s + o.totalVolumeM3, 0) * 10) / 10 };
  const stopsCount = new Set(selectedOrders.map((o) => o.destinationId)).size;

  const goPlans = () => {
    setPlanKey(null);
    setStep("alternativas");
  };
  const choosePlan = (p: PlanOption) => {
    setPlanKey(p.key);
    setChoice({ optionId: p.transportOption.id });
    setStep("contratacao");
  };

  const confirm = async () => {
    if (!plan || busy) return;
    const option = plan.transportOption.id === choice.optionId ? plan.transportOption : undefined;
    const quote = option ?? analysis?.plans.map((p) => p.transportOption).find((o) => o.id === choice.optionId);
    if (!quote) return;
    setBusy(true);
    try {
      const loaded = await createLoad(plan.orderIds);
      if (!loaded.ok) return;
      const load = loaded.data.loads.find((l) => plan.orderIds.every((id) => l.orderIds.includes(id)) && !l.shipmentId);
      if (!load) return;
      const contracted = await createShipment(load.id, quote, tenderExtras(choice, quote));
      if (!contracted.ok) return;
      const shipment = contracted.data.shipments.find((s) => s.loadId === load.id);
      if (shipment) router.push(`/shipments/${shipment.id}`);
    } finally {
      setBusy(false);
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceHeader
        title="Planejamento"
        meta={
          <span className="tabular">
            {awaiting.length} pedido(s) aguardando · consolide, compare alternativas e contrate em um fluxo
          </span>
        }
      >
        <ol aria-label="Etapas do planejamento" className="flex items-center gap-1 text-body-sm">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={s.id} className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={i > stepIndex}
                  onClick={() => i < stepIndex && setStep(s.id)}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-sm px-2 transition-colors",
                    current ? "bg-fg font-medium text-fg-inverse" : done ? "text-fg hover:bg-surface-hover" : "text-fg-subtle"
                  )}
                >
                  <span className={cn("grid size-4 place-items-center rounded-full text-caption", current ? "bg-fg-inverse text-fg" : done ? "bg-success text-fg-inverse" : "border border-line-strong")}>
                    {done ? <Check className="size-3" aria-hidden /> : i + 1}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && <span aria-hidden className="h-px w-4 bg-line-strong sm:w-8" />}
              </li>
            );
          })}
        </ol>
      </WorkspaceHeader>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px] lg:overflow-hidden">
        {/* Área principal da etapa */}
        <div className="orb-scroll min-h-0 lg:overflow-y-auto">
          {step === "demanda" && (
            <div key="demanda" className="animate-orb-rise-in">
              {awaiting.length === 0 ? (
                <EmptyState
                  icon={<Waypoints />}
                  title="Nenhum pedido aguardando planejamento."
                  description="Pedidos novos e solicitações convertidas aparecem aqui."
                  action={
                    <Button asChild>
                      <Link href="/orders?aba=entrada">Ver caixa de entrada</Link>
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line-subtle bg-canvas px-4 py-2.5 md:px-6">
                    <SearchInput label="Buscar pedido" value={q} onChange={setQ} placeholder="Pedido, cliente, destino" className="max-w-sm flex-1" />
                    {reference && <span className="hidden text-caption text-fg-muted sm:inline">Mesma origem de {reference.id} — outros CDs ficam indisponíveis.</span>}
                  </div>
                  {groups.map(([originId, orders]) => {
                    const blocked = !!reference && reference.originId !== originId;
                    return (
                      <section key={originId} aria-label={`Pedidos de ${loc(originId)?.name}`} className={cn("border-b border-line-subtle", blocked && "opacity-55")}>
                        <h2 className="flex items-center gap-2 bg-surface-sunken px-4 py-1.5 text-label text-fg-muted md:px-6">
                          {loc(originId)?.name} <span className="tabular text-fg-subtle">{orders.length}</span>
                          {blocked && <span className="ml-auto text-caption">Origem diferente da seleção</span>}
                        </h2>
                        <ul className="divide-y divide-line-subtle bg-surface">
                          {orders.map((o) => {
                            const on = selected.includes(o.id);
                            const dest = loc(o.destinationId);
                            return (
                              <li key={o.id}>
                                <button
                                  type="button"
                                  aria-pressed={on}
                                  disabled={blocked}
                                  onClick={() => toggle(o.id)}
                                  className={cn(
                                    "orb-focus-inset relative grid w-full grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors md:px-6",
                                    on ? "bg-surface-selected" : "hover:bg-surface-hover",
                                    blocked && "cursor-not-allowed"
                                  )}
                                >
                                  {on && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-brand" />}
                                  <span aria-hidden className={cn("grid size-4 place-items-center rounded-xs border", on ? "border-fg bg-fg text-fg-inverse" : "border-line-strong")}>
                                    {on && <Check className="size-3" />}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="flex items-center gap-2">
                                      <span className="orb-data text-body-sm font-medium text-fg">{o.id}</span>
                                      <span className="truncate text-body-sm text-fg">{customer(o.customerId)?.name}</span>
                                      {o.priority !== "Normal" && <span className={cn("text-caption font-semibold", o.priority === "Urgente" ? "text-danger-fg" : "text-warning-fg")}>{o.priority}</span>}
                                    </span>
                                    <span className="block truncate text-caption text-fg-muted">
                                      → {dest?.name}, {dest?.city} · entrega até <span className="orb-data">{fmtDay(o.dueDate)}</span>
                                      {o.deliveryWindowStart && o.deliveryWindowEnd && (
                                        <span className="orb-data">
                                          {" "}
                                          · {o.deliveryWindowStart}–{o.deliveryWindowEnd}
                                        </span>
                                      )}
                                      {o.cargoCharacteristics.length > 0 && ` · ${o.cargoCharacteristics.join(", ")}`}
                                    </span>
                                  </span>
                                  <span className="orb-data text-body-sm text-fg-muted">{o.totalWeightKg.toLocaleString("pt-BR")} kg</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {step === "alternativas" && analysis && (
            <div key="alternativas" className="animate-orb-rise-in space-y-4 p-4 md:p-6">
              {!analysis.compatible ? (
                <div role="alert" className="flex gap-3 rounded-md border border-danger-line bg-danger-subtle p-4">
                  <AlertTriangle className="mt-0.5 size-5 text-danger" aria-hidden />
                  <div>
                    <p className="text-h3 text-danger-fg">Capacidade excedida</p>
                    <p className="text-body-sm text-danger-fg">
                      Carga de <span className="orb-data">{analysis.totalWeightKg.toLocaleString("pt-BR")} kg</span> — nenhum veículo disponível comporta esse volume. Remova pedidos da seleção.
                    </p>
                    <Button size="sm" className="mt-2" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={() => setStep("demanda")}>
                      Refazer seleção
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-success-line bg-success-subtle px-3 py-2 text-body-sm text-success-fg">
                    <CheckCircle2 className="size-4" aria-hidden />
                    Consolidação viável · mesma origem · {analysis.vehicle?.id} ({analysis.vehicle?.type}) comporta · ocupação estimada{" "}
                    <span className="orb-data">{Math.round((analysis.totalWeightKg / (analysis.vehicle?.capacityKg ?? 1)) * 100)}%</span>
                  </div>
                  <p className="text-caption text-fg-muted">Índice de adequação: custo 30% · prazo 20% · SLA 20% · ocupação 15% · OTIF 15%. Frete simulado — menor frete não é necessariamente o melhor plano.</p>
                  <div className="grid gap-3 xl:grid-cols-3">
                    {analysis.plans.map((p) => {
                      const rec = p.key === analysis.recommendedKey;
                      return (
                        <article key={p.key} aria-label={`Plano ${p.key}`} className={cn("flex flex-col rounded-lg border bg-surface", rec ? "border-fg shadow-2" : "border-line-subtle")}>
                          <div className="border-b border-line-subtle px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-h3 text-fg">
                                Plano {p.key} · {p.name}
                              </p>
                              {rec && <span className="rounded-xs bg-brand-subtle px-1.5 text-caption font-medium text-brand-fg">Recomendado</span>}
                            </div>
                            <p className="text-caption text-fg-muted">{p.strategy}</p>
                          </div>
                          <div className="flex-1 space-y-3 px-4 py-3">
                            <div className="flex items-baseline justify-between">
                              <span className="font-display text-display tabular text-fg">{p.score}</span>
                              <span className="text-caption text-fg-muted">índice /100</span>
                            </div>
                            <MetricGrid
                              items={[
                                { label: "Frete", value: p.transportOption.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), mono: true },
                                { label: "Prazo", value: `D+${p.transportOption.etaDays}`, mono: true },
                                { label: "SLA · OTIF", value: `${p.transportOption.slaPercent}% · ${p.transportOption.otifPercent}%`, mono: true },
                                { label: "Ocupação", value: `${p.occupancyPercent}%`, mono: true },
                              ]}
                            />
                            <p className="text-body-sm text-fg">
                              {p.transportOption.isOwnFleet ? `Frota própria · ${p.vehicle.id} (${p.vehicle.type})` : p.transportOption.label}
                            </p>
                            <button type="button" aria-expanded={why === p.key} onClick={() => setWhy(why === p.key ? null : p.key)} className="flex items-center gap-1 text-body-sm font-medium text-fg underline underline-offset-2 hover:no-underline">
                              Por que este plano?
                              <ChevronDown className={cn("size-4 transition-transform duration-(--orb-duration-base)", why === p.key && "rotate-180")} aria-hidden />
                            </button>
                            <div className="orb-collapsible" data-open={why === p.key}>
                              <div>
                                <ul className="space-y-1">
                                  {explainPlan(p, analysis.plans).map((r, i) => (
                                    <li key={i} className="flex gap-1.5 text-caption text-fg">
                                      <Check className="mt-0.5 size-3 shrink-0 text-success" aria-hidden />
                                      {r}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                          <div className="border-t border-line-subtle px-4 py-3">
                            <Button variant={rec ? "primary" : "secondary"} className="w-full" onClick={() => choosePlan(p)}>
                              Selecionar plano
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {step === "contratacao" && plan && (
            <div key="contratacao" className="animate-orb-rise-in space-y-4 p-4 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-h2 text-fg">
                  Plano {plan.key} · {plan.name}
                </p>
                <Button size="sm" variant="ghost" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={() => setStep("alternativas")}>
                  Trocar plano
                </Button>
              </div>
              <TenderPanel weightKg={plan.totalWeightKg} value={choice} onChange={setChoice} recommendedId={plan.transportOption.id} options={[plan.transportOption]} />
            </div>
          )}
        </div>

        {/* Resumo da seleção (sempre visível) */}
        <aside aria-label="Seleção" className="flex min-h-0 flex-col border-t border-line-subtle bg-surface lg:border-l lg:border-t-0">
          <div className="border-b border-line-subtle px-4 py-3">
            <p className="text-h3 text-fg">Seleção</p>
            <p className="text-caption text-fg-muted">{reference ? `Origem: ${loc(reference.originId)?.name}` : "Escolha pedidos da mesma origem."}</p>
          </div>
          <div className="space-y-3 px-4 py-3">
            <MetricGrid
              items={[
                { label: "Pedidos", value: selectedOrders.length },
                { label: "Paradas", value: stopsCount },
                { label: "Peso", value: `${totals.weight.toLocaleString("pt-BR")} kg`, mono: true },
                { label: "Volume", value: `${totals.volume.toLocaleString("pt-BR")} m³`, mono: true },
              ]}
            />
            {selectedOrders.length > 0 && (
              <ul className="orb-scroll max-h-56 space-y-1 overflow-y-auto">
                {selectedOrders.map((o) => (
                  <li key={o.id} className="flex items-center gap-2 text-body-sm">
                    <Package className="size-3.5 text-fg-muted" aria-hidden />
                    <span className="orb-data text-fg">{o.id}</span>
                    <span className="truncate text-fg-muted">{loc(o.destinationId)?.city}</span>
                    <span className="orb-data ml-auto text-caption text-fg-muted">{o.totalWeightKg.toLocaleString("pt-BR")} kg</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-auto space-y-2 border-t border-line-subtle px-4 py-3">
            {step === "demanda" && (
              <>
                <Button variant="primary" className="w-full" disabled={selectedOrders.length === 0} onClick={goPlans}>
                  Analisar consolidação
                </Button>
                {selected.length > 0 && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelected([])}>
                    Limpar seleção
                  </Button>
                )}
              </>
            )}
            {step === "alternativas" && (
              <Button className="w-full" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={() => setStep("demanda")}>
                Refazer seleção
              </Button>
            )}
            {step === "contratacao" && plan && (
              <>
                <p className="flex items-center justify-between text-body-sm">
                  <span className="text-fg-muted">Total do frete</span>
                  <span className="orb-data font-semibold text-fg">{plan.transportOption.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </p>
                <Button variant="primary" className="w-full" loading={busy} disabled={!can("shipments:contract") || !choice.optionId} onClick={confirm}>
                  Confirmar planejamento
                </Button>
                <p className="text-caption text-fg-subtle">Cria a carga, contrata o transporte e abre a viagem.</p>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
