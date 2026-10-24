"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { FastForward, Pause, Play, RotateCcw, Truck, X } from "lucide-react";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { Button, Checkbox, KeyValue, SegmentedControl, Tabs } from "@/components/ds";
import {
  DEMO_ITEMS,
  KIND_LABEL,
  VEHICLES,
  axleLoads,
  cgWindow,
  laneLetter,
  packCargo,
  type CargoItem,
  type PackResult,
  type PlacedBox,
  type Vehicle3D,
} from "@/lib/planning/cargo";
import { cn } from "@/lib/ui/cn";
import type { SceneControl } from "./CargoScene";

// WebGL só no cliente.
const CargoScene = dynamic(() => import("./CargoScene").then((m) => m.CargoScene), { ssr: false });

const kg = (n: number) => `${n.toLocaleString("pt-BR")} kg`;
const ton = (n: number) => `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} t`;
const meters = (cm: number) => `${(cm / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m`;

type ItemFilter = "todos" | "carregados" | "fora" | "especiais";

export function CargoPlanner() {
  const [items, setItems] = useState(DEMO_ITEMS);
  const [vehicleId, setVehicleId] = useState("truck");
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<PackResult | null>(null);
  const [focus, setFocus] = useState<{ itemId: string; box?: PlacedBox } | null>(null);
  const [control, setControl] = useState<SceneControl>({ playing: false, speed: 2, seek: { t: 0, n: 0 }, view: "3d" });
  const [progress, setProgress] = useState({ loaded: 0, done: false });
  const [filter, setFilter] = useState<ItemFilter>("todos");
  const [notice, setNotice] = useState<string | null>(null);

  const vehicle = VEHICLES.find((v) => v.id === vehicleId)!;
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const ordered = useMemo(() => [...items].sort((a, b) => a.stop - b.stop || a.id.localeCompare(b.id)), [items]);
  const focusItem = focus ? byId.get(focus.itemId) : null;

  const seek = (to: number, playing = false) => setControl((c) => ({ ...c, playing, seek: { t: to, n: c.seek.n + 1 } }));
  const onPick = useCallback((b: PlacedBox | null) => setFocus(b ? { itemId: b.itemId, box: b } : null), []);

  // Rua de cada parada entre as cargas marcadas: A = 1ª entrega.
  const laneOf = useMemo(() => {
    const stops = [...new Set(items.filter((i) => selected.includes(i.id)).map((i) => i.stop))].sort((x, y) => x - y);
    return new Map(stops.map((st, idx) => [st, laneLetter(idx)]));
  }, [items, selected]);

  const axles = useMemo(() => (result ? axleLoads(result.placed, items, vehicle) : []), [result, items, vehicle]);
  const legal = axles.every((a) => a.legal);

  const onProgress = useCallback(
    (loaded: number, done: boolean) => {
      setProgress({ loaded, done });
      if (done) {
        setControl((c) => (c.playing ? { ...c, playing: false } : c));
        setNotice(`Carregado: ${loaded} volumes, última entrega primeiro. Eixos ${legal ? "dentro do limite" : "ACIMA do limite"} em todas as etapas.`);
      }
    },
    [legal]
  );

  const plan = (list: CargoItem[], v: Vehicle3D, message: (r: PackResult) => string) => {
    const r = packCargo(list, v);
    setResult(r);
    setFocus(null);
    setProgress({ loaded: 0, done: false });
    seek(0);
    setNotice(message(r));
  };
  const chosen = () => items.filter((i) => selected.includes(i.id));
  const lanesCount = (r: PackResult) => new Set(r.placed.map((p) => byId.get(p.itemId)!.stop)).size;
  const apply = () => plan(chosen(), vehicle, (r) => `Separado em ${lanesCount(r)} ruas: ${r.placed.length} volumes prontos para carregar.`);
  const changeVehicle = (id: string) => {
    setVehicleId(id);
    const v = VEHICLES.find((x) => x.id === id)!;
    // Com carga já separada, replaneja na hora para o novo veículo.
    if (result) plan(chosen(), v, (r) => `Replanejado para ${v.name}: ${r.placed.length} volumes cabem${r.unplaced.length ? `, ${r.unplaced.reduce((s, u) => s + u.count, 0)} ficam de fora` : ""}.`);
  };
  const clear = () => {
    setResult(null);
    setFocus(null);
    setNotice(null);
  };
  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const setStop = (id: string, stop: number) => setItems((p) => p.map((i) => (i.id === id ? { ...i, stop: Math.max(1, stop || 1) } : i)));

  // Progresso por rua (volumes já no baú / total da rua).
  const lanes = useMemo(() => {
    if (!result) return [];
    const loadedKeys = new Set(result.placed.slice(0, progress.loaded).map((p) => p.key));
    const stops = [...new Set(result.placed.map((p) => byId.get(p.itemId)!.stop))].sort((a, b) => a - b);
    return stops.map((stop, idx) => {
      const boxes = result.placed.filter((p) => byId.get(p.itemId)!.stop === stop);
      return {
        letter: laneLetter(idx),
        stop,
        total: boxes.length,
        loaded: boxes.filter((b) => loadedKeys.has(b.key)).length,
        weight: boxes.reduce((s, b) => s + byId.get(b.itemId)!.weightKg, 0),
      };
    });
  }, [result, progress.loaded, byId]);

  const cgRange = result ? cgWindow(result.weightKg, vehicle) : null;

  const itemRows = useMemo(() => {
    if (!result) return [];
    const placedCount = new Map<string, number>();
    for (const p of result.placed) placedCount.set(p.itemId, (placedCount.get(p.itemId) ?? 0) + 1);
    return ordered
      .filter((i) => selected.includes(i.id))
      .map((i) => ({ item: i, placed: placedCount.get(i.id) ?? 0 }))
      .filter(({ item, placed }) => {
        if (filter === "carregados") return placed > 0;
        if (filter === "fora") return placed < item.quantity;
        if (filter === "especiais") return item.kind === "fragil" || item.kind === "tambor" || !item.stackable;
        return true;
      });
  }, [result, ordered, selected, filter]);
  const selectedUnits = items.filter((i) => selected.includes(i.id)).reduce((s, i) => s + i.quantity, 0);
  const outCount = result ? result.unplaced.reduce((s, u) => s + u.count, 0) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceHeader
        title="Planejamento de carga 3D"
        meta="Demonstrativo · marque as cargas, separe nas ruas e carregue. A rua A (1ª entrega) entra por último e fica junto à porta."
        actions={
          <>
            <select
              aria-label="Veículo"
              value={vehicleId}
              onChange={(e) => changeVehicle(e.target.value)}
              className="h-8 rounded-sm border border-line bg-surface px-2 text-body-sm text-fg"
            >
              {VEHICLES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <Button icon={<RotateCcw />} onClick={clear} disabled={!result}>
              Limpar
            </Button>
            <Button variant="primary" icon={<Play />} onClick={apply} disabled={!selected.length}>
              Separar nas ruas ({selected.length})
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_1fr]">
        <aside className="min-h-0 overflow-y-auto border-b border-line-subtle lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 py-2 text-caption text-fg-muted">
            <Checkbox
              label="Selecionar todas"
              checked={selected.length === items.length}
              indeterminate={selected.length > 0 && selected.length < items.length}
              onChange={(v) => setSelected(v ? items.map((i) => i.id) : [])}
            />
            <span>Rua · Parada</span>
          </div>
          <ul>
            {ordered.map((i) => (
              <li key={i.id} className={cn("flex items-center gap-3 border-t border-line-subtle px-4 py-2.5", focus?.itemId === i.id && "bg-surface-selected")}>
                <Checkbox label={`Carregar ${i.name}`} checked={selected.includes(i.id)} onChange={() => toggle(i.id)} />
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setFocus(focus?.itemId === i.id ? null : { itemId: i.id })}>
                  <span className="size-3 shrink-0 rounded-xs" style={{ background: i.color }} aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-body-sm font-medium text-fg">{i.name}</span>
                    <span className="block truncate text-caption text-fg-muted">
                      {i.quantity}× · {i.length}×{i.width}×{i.height} cm · {KIND_LABEL[i.kind]}
                      {!i.stackable && " · não empilha"}
                    </span>
                  </span>
                </button>
                <span className="w-5 text-center text-caption font-semibold text-fg-muted" title="Rua no pátio">
                  {selected.includes(i.id) ? laneOf.get(i.stop) : ""}
                </span>
                <input
                  type="number"
                  min={1}
                  aria-label={`Ordem de entrega de ${i.name}`}
                  value={i.stop}
                  onChange={(e) => setStop(i.id, Number(e.target.value))}
                  className="h-7 w-12 rounded-sm border border-line bg-surface px-1.5 text-center text-body-sm tabular text-fg"
                />
              </li>
            ))}
          </ul>
        </aside>

        <section className="min-h-0 overflow-y-auto">
          {/* ------------------------------------------------ cena 3D */}
          <div className="relative h-[560px] bg-surface-sunken">
            {result ? (
              <CargoScene vehicle={vehicle} boxes={result.placed} items={items} selectedItemId={focus?.itemId ?? null} control={control} onPick={onPick} onProgress={onProgress} />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-body-sm text-fg-muted">
                Nenhuma carga separada. Marque os itens na lista e clique em <strong className="mx-1 text-fg">Separar nas ruas</strong>.
              </div>
            )}

            {result && (
              <div className="absolute left-3 right-3 top-3 flex flex-wrap items-start gap-2">
                <SegmentedControl
                  size="sm"
                  label="Vista"
                  value={control.view}
                  onChange={(v) => setControl((c) => ({ ...c, view: v }))}
                  options={[
                    { value: "3d", label: "3D" },
                    { value: "lateral", label: "Lateral" },
                    { value: "topo", label: "Topo" },
                  ]}
                  className="bg-surface/95 shadow-1"
                />
                <div className="flex flex-wrap gap-2">
                  {lanes.map((l) => (
                    <div key={l.letter} className="w-[104px] rounded-md border border-line bg-surface/95 px-2.5 py-1.5 shadow-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-body-sm font-semibold text-fg">Rua {l.letter}</span>
                        <span className="text-caption tabular text-fg-muted">
                          {l.loaded}/{l.total}
                        </span>
                      </div>
                      <div className="text-caption text-fg-muted">{l.stop}ª entrega</div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(l.loaded / l.total) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result && notice && (
              <div className="absolute left-1/2 top-24 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface/95 px-4 py-1.5 text-body-sm text-fg shadow-2" role="status">
                <span className={cn("size-2 shrink-0 rounded-full", legal ? "bg-success" : "bg-danger")} aria-hidden />
                {notice}
              </div>
            )}

            {result && result.placed.length > 0 && (
              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface/95 p-2 shadow-2">
                {control.playing ? (
                  <Button size="sm" icon={<Pause />} onClick={() => setControl((c) => ({ ...c, playing: false }))}>
                    Pausar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Truck />}
                    onClick={() => {
                      setNotice(progress.loaded ? null : "Carregando pela última entrega: a empilhadeira busca rua por rua.");
                      if (progress.done) seek(0, true);
                      else setControl((c) => ({ ...c, playing: true }));
                    }}
                  >
                    {progress.done ? "Carregar de novo" : progress.loaded ? "Continuar" : "Carregar caminhão"}
                  </Button>
                )}
                <Button
                  size="sm"
                  icon={<FastForward />}
                  onClick={() => {
                    setNotice("Avanço rápido: o restante da sequência, parada por parada.");
                    seek(result.placed.length);
                  }}
                  disabled={progress.done}
                >
                  Concluir
                </Button>
                <Button size="sm" icon={<RotateCcw />} onClick={() => seek(0)} disabled={!progress.loaded && !control.playing}>
                  Voltar às ruas
                </Button>
                <SegmentedControl
                  size="sm"
                  label="Velocidade"
                  value={String(control.speed)}
                  onChange={(v) => setControl((c) => ({ ...c, speed: Number(v) }))}
                  options={[1, 2, 4, 8].map((n) => ({ value: String(n), label: `${n}×` }))}
                />
                <span className="ml-auto text-caption tabular text-fg-muted">
                  {progress.done ? "Carregamento concluído" : `${progress.loaded} de ${result.placed.length} volumes no baú`}
                </span>
              </div>
            )}

            {focusItem && (
              <div className="absolute right-3 top-20 w-72 rounded-md border border-line bg-surface p-4 shadow-2">
                <div className="mb-2 flex items-start gap-2">
                  <span className="mt-1 size-3 shrink-0 rounded-xs" style={{ background: focusItem.color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-medium text-fg">{focusItem.name}</div>
                    <div className="text-caption text-fg-muted">{focusItem.description}</div>
                  </div>
                  <button type="button" aria-label="Fechar" onClick={() => setFocus(null)} className="text-fg-muted hover:text-fg">
                    <X className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <KeyValue label="Cliente" value={focusItem.customer} />
                  <KeyValue label="Parada" value={`${focusItem.stop}ª entrega · Rua ${laneOf.get(focusItem.stop) ?? "—"}`} />
                  <KeyValue label="Tipo" value={KIND_LABEL[focusItem.kind]} />
                  <KeyValue label="Peso unit." value={kg(focusItem.weightKg)} />
                  <KeyValue label="Dimensões" value={`${focusItem.length}×${focusItem.width}×${focusItem.height} cm`} />
                  <KeyValue label="Empilhável" value={focusItem.stackable ? "Sim" : "Não"} />
                  {focus?.box && <KeyValue label="Volume" value={`${focus.box.unit} de ${focusItem.quantity}`} />}
                  {focus?.box && <KeyValue label="Posição" value={`${meters(focus.box.x)} da cabine`} />}
                </div>
              </div>
            )}
          </div>

          {result && (
            <div className="grid gap-4 p-4 xl:grid-cols-2">
              {/* ------------------------------------------ peso por eixo */}
              <Card
                title="Peso por eixo"
                aside={
                  <span className={cn("rounded-full px-2 py-0.5 text-caption font-semibold", legal ? "bg-success/15 text-success-fg" : "bg-danger/15 text-danger-fg")}>
                    {legal ? "Dentro do limite" : "Acima do limite"}
                  </span>
                }
              >
                {axles[0] && (
                  <div className="space-y-3">
                    <AxleBar label={vehicle.axles.frontLabel} value={axles[0].frontKg} limit={vehicle.axles.limitFrontKg} />
                    <AxleBar label={vehicle.axles.rearLabel} value={axles[0].rearKg} limit={vehicle.axles.limitRearKg} />
                  </div>
                )}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-caption">
                    <thead>
                      <tr className="text-fg-subtle">
                        <th className="pb-1 text-left font-medium">Eixo</th>
                        {axles.map((a) => (
                          <th key={a.afterStop} className="pb-1 text-center font-medium">
                            {a.afterStop === 0 ? "Saída" : `Após ${a.afterStop}ª`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(["front", "rear"] as const).map((k) => (
                        <tr key={k}>
                          <td className="py-0.5 pr-2 text-fg-muted">{k === "front" ? vehicle.axles.frontLabel : vehicle.axles.rearLabel}</td>
                          {axles.map((a) => {
                            const pct = k === "front" ? a.frontPercent : a.rearPercent;
                            return (
                              <td key={a.afterStop} className="px-0.5 py-0.5">
                                <div className="relative h-5 overflow-hidden rounded-xs bg-surface-sunken">
                                  <div
                                    className={cn("absolute inset-y-0 left-0", pct > 100 ? "bg-danger/40" : pct > 90 ? "bg-warning/40" : "bg-success/30")}
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                  <span className="relative block text-center leading-5 tabular text-fg">{pct}%</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* ------------------------------------- centro de gravidade */}
              <Card title="Centro de gravidade" aside={<span className="text-caption text-fg-muted">distância da parede da cabine</span>}>
                <CgRuler length={vehicle.length} range={cgRange} stages={axles} />
                <p className="mt-3 text-body-sm text-fg-muted">
                  {axles[0]?.cgX != null ? (
                    <>
                      Na saída o centro de gravidade fica a <strong className="text-fg">{meters(axles[0].cgX)}</strong> da cabine.
                      {cgRange ? (
                        <>
                          {" "}
                          Para {ton(result.weightKg)} de carga, os dois eixos ficam dentro do limite com o centro entre <strong className="text-fg">{meters(cgRange.min)}</strong> e{" "}
                          <strong className="text-fg">{meters(cgRange.max)}</strong>.
                        </>
                      ) : (
                        " Com esse peso não existe posição em que os dois eixos fiquem dentro do limite."
                      )}{" "}
                      Os pontos numerados mostram o centro após cada entrega.
                    </>
                  ) : (
                    "Sem carga no baú."
                  )}
                </p>
              </Card>

              {/* --------------------------------------------- indicadores */}
              <div className="grid grid-cols-2 gap-4 xl:col-span-2 xl:grid-cols-5">
                <Stat label="Peso da carga" value={ton(result.weightKg)} hint={`${result.weightPercent}% da capacidade de ${ton(vehicle.maxWeightKg)}`} />
                <Stat
                  label="Capacidade restante"
                  value={ton(Math.max(0, vehicle.maxWeightKg - result.weightKg))}
                  hint={result.weightPercent >= result.occupancyPercent ? "o peso é o limite" : "o volume é o limite"}
                />
                <Stat label="Ocupação" value={`${Math.round(result.occupancyPercent)}% · ${Math.round(result.weightPercent)}%`} hint="volume · peso" />
                <Stat label="Ruas usadas" value={`${lanes.length}`} hint={lanes.length ? `mais pesada: Rua ${[...lanes].sort((a, b) => b.weight - a.weight)[0].letter}` : "—"} />
                <Stat label="Volumes no baú" value={`${result.placed.length} de ${selectedUnits}`} hint={outCount ? `${outCount} ficaram de fora` : "tudo coube"} />
              </div>

              {/* ------------------------------------------ tabela de itens */}
              <div className="xl:col-span-2">
                <Card title="Itens">
                  <Tabs
                    label="Filtrar itens"
                    value={filter}
                    onChange={setFilter}
                    tabs={[
                      { value: "todos", label: "Todos" },
                      { value: "carregados", label: "No caminhão" },
                      { value: "fora", label: "Fora da carga", attention: outCount > 0 },
                      { value: "especiais", label: "Especiais" },
                    ]}
                  />
                  <div className="overflow-x-auto">
                    <table className="mt-2 w-full text-body-sm">
                      <thead>
                        <tr className="text-left text-caption text-fg-subtle">
                          <th className="py-2 font-medium">Item</th>
                          <th className="py-2 font-medium">Código</th>
                          <th className="py-2 font-medium">Cliente</th>
                          <th className="py-2 text-center font-medium">Rua</th>
                          <th className="py-2 text-right font-medium">No baú</th>
                          <th className="py-2 text-right font-medium">Peso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemRows.map(({ item, placed }) => (
                          <tr key={item.id} className="cursor-pointer border-t border-line-subtle hover:bg-surface-hover" onClick={() => setFocus({ itemId: item.id })}>
                            <td className="py-2">
                              <span className="flex items-center gap-2">
                                <span className="size-2.5 rounded-xs" style={{ background: item.color }} aria-hidden />
                                {item.name}
                              </span>
                            </td>
                            <td className="py-2 font-mono text-caption text-fg-muted">{item.id}</td>
                            <td className="py-2 text-fg-muted">{item.customer}</td>
                            <td className="py-2 text-center">{laneOf.get(item.stop)}</td>
                            <td className={cn("py-2 text-right tabular", placed < item.quantity && "text-danger-fg")}>
                              {placed}/{item.quantity}
                            </td>
                            <td className="py-2 text-right tabular text-fg-muted">{kg(item.weightKg * item.quantity)}</td>
                          </tr>
                        ))}
                        {!itemRows.length && (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-fg-muted">
                              Nenhum item neste filtro.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Card({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line-subtle bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-h3 font-semibold text-fg">{title}</h2>
        {aside}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border border-line-subtle bg-surface p-4">
      <div className="text-caption text-fg-muted">{label}</div>
      <div className="mt-1 font-display text-h2 tabular text-fg">{value}</div>
      <div className="mt-0.5 text-caption text-fg-muted">{hint}</div>
    </div>
  );
}

function AxleBar({ label, value, limit }: { label: string; value: number; limit: number }) {
  const pct = (value / limit) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between text-body-sm">
        <span className="text-fg">{label}</span>
        <span className="tabular">
          <strong className="text-fg">{kg(value)}</strong> <span className="text-fg-subtle">/ {kg(limit)}</span>
        </span>
      </div>
      <div className="relative mt-1 h-2 rounded-full bg-surface-sunken">
        <div className={cn("h-full rounded-full", pct > 100 ? "bg-danger" : pct > 90 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function CgRuler({ length, range, stages }: { length: number; range: { min: number; max: number } | null; stages: ReturnType<typeof axleLoads> }) {
  const pos = (cm: number) => `${(Math.min(length, Math.max(0, cm)) / length) * 100}%`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(length * f));
  return (
    <div className="pt-6">
      <div className="relative h-10 rounded-sm border border-line bg-surface-sunken">
        <span className="absolute -top-5 left-0 text-caption text-fg-subtle">Cabine</span>
        <span className="absolute -top-5 right-0 text-caption text-fg-subtle">Porta</span>
        {range && <div className="absolute inset-y-0 border-x-2 border-success bg-success/20" style={{ left: pos(range.min), width: pos(range.max - range.min) }} title="Faixa permitida" />}
        {stages.map((s, i) =>
          s.cgX == null ? null : (
            <div
              key={s.afterStop}
              className={cn(
                "absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-caption font-semibold",
                i === 0 ? "z-10 size-5 bg-primary text-primary-fg" : "size-5 border-2 border-primary bg-surface text-fg"
              )}
              style={{ left: pos(s.cgX) }}
              title={i === 0 ? "Saída" : `Após ${s.afterStop}ª entrega`}
            >
              {i === 0 ? "" : s.afterStop}
            </div>
          )
        )}
      </div>
      <div className="relative mt-1 h-4 text-caption tabular text-fg-subtle">
        {ticks.map((x, i) => (
          <span key={x} className={cn("absolute", i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: pos(x) }}>
            {meters(x)}
          </span>
        ))}
      </div>
    </div>
  );
}
