"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Play, RotateCcw, X } from "lucide-react";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { Button, Checkbox, KeyValue, MetricGrid, Progress } from "@/components/ds";
import { DEMO_ITEMS, KIND_LABEL, VEHICLES, packCargo, type PackResult, type PlacedBox } from "@/lib/planning/cargo";
import { cn } from "@/lib/ui/cn";

// WebGL só no cliente.
const CargoScene = dynamic(() => import("./CargoScene").then((m) => m.CargoScene), { ssr: false });

export function CargoPlanner() {
  const [items, setItems] = useState(DEMO_ITEMS);
  const [vehicleId, setVehicleId] = useState("truck");
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<PackResult | null>(null);
  const [focus, setFocus] = useState<{ itemId: string; box?: PlacedBox } | null>(null);

  const vehicle = VEHICLES.find((v) => v.id === vehicleId)!;
  const ordered = useMemo(() => [...items].sort((a, b) => a.stop - b.stop || a.id.localeCompare(b.id)), [items]);
  const focusItem = focus ? items.find((i) => i.id === focus.itemId) : null;

  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const setStop = (id: string, stop: number) => setItems((p) => p.map((i) => (i.id === id ? { ...i, stop: Math.max(1, stop || 1) } : i)));
  const apply = () => {
    setResult(packCargo(items.filter((i) => selected.includes(i.id)), vehicle));
    setFocus(null);
  };
  const clear = () => {
    setResult(null);
    setFocus(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceHeader
        title="Planejamento de carga 3D"
        meta="Demonstrativo · marque as cargas e clique em Aplicar. A 1ª parada entra por último e fica junto à porta."
        actions={
          <>
            <select
              aria-label="Veículo"
              value={vehicleId}
              onChange={(e) => {
                setVehicleId(e.target.value);
                setResult(null);
              }}
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
              Aplicar carga ({selected.length})
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[380px_1fr]">
        <aside className="min-h-0 overflow-y-auto border-b border-line-subtle lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 py-2 text-caption text-fg-muted">
            <Checkbox
              label="Selecionar todas"
              checked={selected.length === items.length}
              indeterminate={selected.length > 0 && selected.length < items.length}
              onChange={(v) => setSelected(v ? items.map((i) => i.id) : [])}
            />
            <span>Parada</span>
          </div>
          <ul>
            {ordered.map((i) => (
              <li
                key={i.id}
                className={cn("flex items-center gap-3 border-t border-line-subtle px-4 py-2.5", focus?.itemId === i.id && "bg-surface-selected")}
              >
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

        <section className="relative flex min-h-[420px] flex-col">
          <div className="relative min-h-0 flex-1 bg-surface-sunken">
            {result ? (
              <CargoScene
                vehicle={vehicle}
                boxes={result.placed}
                items={items}
                selectedItemId={focus?.itemId ?? null}
                onPick={(b) => setFocus(b ? { itemId: b.itemId, box: b } : null)}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-body-sm text-fg-muted">
                Nenhuma carga aplicada. Marque os itens na lista e clique em <strong className="mx-1 text-fg">Aplicar carga</strong>.
              </div>
            )}
            {result && (
              <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 text-caption text-fg-muted">
                <span>◀ Cabine</span>
                <span>Porta ▶</span>
              </div>
            )}

            {focusItem && (
              <div className="absolute right-3 top-3 w-72 rounded-md border border-line bg-surface p-4 shadow-2">
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
                  <KeyValue label="Parada" value={`${focusItem.stop}ª entrega`} />
                  <KeyValue label="Tipo" value={KIND_LABEL[focusItem.kind]} />
                  <KeyValue label="Peso unit." value={`${focusItem.weightKg} kg`} />
                  <KeyValue label="Dimensões" value={`${focusItem.length}×${focusItem.width}×${focusItem.height} cm`} />
                  <KeyValue label="Empilhável" value={focusItem.stackable ? "Sim" : "Não"} />
                  {focus?.box && <KeyValue label="Volume" value={`${focus.box.unit} de ${focusItem.quantity}`} />}
                  {focus?.box && <KeyValue label="Posição" value={`${Math.round(focus.box.x)} cm da cabine`} />}
                </div>
              </div>
            )}
          </div>

          {result && (
            <div className="grid gap-4 border-t border-line-subtle p-4 md:grid-cols-[1fr_1fr]">
              <div className="space-y-3">
                <Progress label={`Volume ${result.volumeUsedM3} / ${result.volumeTotalM3} m³`} value={result.occupancyPercent} tone={result.occupancyPercent > 95 ? "warning" : "info"} />
                <Progress label={`Peso ${result.weightKg.toLocaleString("pt-BR")} / ${vehicle.maxWeightKg.toLocaleString("pt-BR")} kg`} value={result.weightPercent} tone={result.weightPercent > 95 ? "warning" : "success"} />
                <MetricGrid
                  columns={3}
                  items={[
                    { label: "Volumes carregados", value: result.placed.length },
                    { label: "Ocupação", value: `${result.occupancyPercent}%` },
                    { label: "Não couberam", value: result.unplaced.reduce((s, u) => s + u.count, 0), tone: result.unplaced.length ? "warning" : undefined },
                  ]}
                />
              </div>
              <div>
                <div className="mb-1 text-label text-fg-muted">Fora da carga</div>
                {result.unplaced.length ? (
                  <ul className="space-y-1 text-body-sm">
                    {result.unplaced.map((u) => (
                      <li key={u.itemId} className="text-fg">
                        {u.count}× {items.find((i) => i.id === u.itemId)?.name} <span className="text-fg-muted">— {u.reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body-sm text-fg-muted">Tudo o que foi selecionado coube no veículo.</p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
