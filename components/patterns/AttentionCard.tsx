"use client";

import { Ellipsis, Map as MapIcon, Play, ShieldCheck, Timer, PanelRightOpen } from "lucide-react";
import { useOperation } from "@/components/operation/OperationProvider";
import { Button, IconButton, Menu, Status, AttentionMeter } from "@/components/ds";
import type { AttentionAction, AttentionItem } from "@/lib/ui/attention";
import { hhmm } from "@/lib/ui/trip";
import { cn } from "@/lib/ui/cn";
import { useTripActions } from "./TripActions";

// Item da fila "Agora": nível + objeto + janela × ETA + MOTIVO + até 2 ações.
// Nunca mostra só o número: o score aparece junto da explicação e, ao
// expandir, a soma das regras que o compõem.

const LEVEL_EDGE: Record<AttentionItem["level"], string> = {
  critica: "before:bg-critical",
  alta: "before:bg-danger",
  media: "before:bg-warning",
  baixa: "before:bg-line-strong",
};

export function AttentionCard({
  item,
  selected,
  onSelect,
  onOpen,
}: {
  item: AttentionItem;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const { data, can, createOccurrence, startShipment } = useOperation();
  const shipment = data.shipments.find((s) => s.id === item.shipmentId) ?? null;
  const { actions: tripActions, dialogs } = useTripActions(shipment);
  const resolve = tripActions.find((a) => a.id === "resolve");

  const ACTION: Record<AttentionAction, { label: string; icon: React.ReactNode; run: () => void; allowed: boolean } | null> = {
    "ver-rota": { label: "Ver rota", icon: <MapIcon />, run: onSelect, allowed: true },
    resolver: resolve ? { label: "Resolver", icon: <ShieldCheck />, run: resolve.run, allowed: true } : null,
    "registrar-atraso": { label: "Registrar atraso", icon: <Timer />, run: () => void createOccurrence(item.shipmentId, "Atraso"), allowed: can("occurrences:report") },
    iniciar: { label: "Iniciar viagem", icon: <Play />, run: () => void startShipment(item.shipmentId), allowed: can("shipments:execute") },
    abrir: { label: "Abrir", icon: <PanelRightOpen />, run: onOpen, allowed: true },
  };
  const buttons = item.actions.map((a) => ACTION[a]).filter((a): a is NonNullable<typeof a> => !!a && a.allowed).slice(0, 2);

  return (
    <article
      aria-label={`${item.title}: ${item.headline}`}
      className={cn(
        "relative overflow-hidden rounded-md border bg-surface transition-[border-color,box-shadow,background-color] duration-(--orb-duration-base) ease-standard",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        LEVEL_EDGE[item.level],
        selected ? "border-fg shadow-2" : "border-line-subtle hover:border-line-strong"
      )}
    >
      <button type="button" onClick={onSelect} aria-expanded={selected} className="orb-focus-inset block w-full px-3.5 pb-2 pl-4 pt-3 text-left">
        <span className="flex items-center justify-between gap-2">
          <Status entity="attention" value={item.level} size="sm" />
          <span className="flex items-center gap-1.5 text-caption text-fg-muted">
            <span className="sr-only">Attention Score</span>
            <AttentionMeter score={item.score} level={item.level} />
          </span>
        </span>
        <span className="mt-2 block">
          <span className="orb-data block text-body font-semibold text-fg">{item.title}</span>
          <span className="block truncate text-body-sm text-fg-muted">{item.subject}</span>
        </span>
        {(item.window || item.eta) && (
          <span className="mt-2 grid grid-cols-2 gap-2 text-caption">
            <span>
              <span className="block text-fg-subtle">Janela</span>
              <span className="orb-data text-body-sm text-fg">{item.window ?? "—"}</span>
            </span>
            <span>
              <span className="block text-fg-subtle">ETA</span>
              <span className={cn("orb-data text-body-sm", item.reasons.some((r) => r.code === "late") ? "font-semibold text-danger-fg" : "text-fg")}>{hhmm(item.eta)}</span>
            </span>
          </span>
        )}
        <span className="mt-2 block text-body-sm text-fg">
          <span className="font-medium">Motivo: </span>
          {item.headline}
        </span>
      </button>

      <div className="orb-collapsible" data-open={selected}>
        <div>
          <div className="mx-4 mb-2 rounded-sm bg-surface-sunken px-3 py-2">
            <p className="mb-1 text-caption font-medium text-fg-muted">Por que está aqui · Attention Score {item.score}</p>
            <ul className="space-y-0.5">
              {item.reasons.map((r) => (
                <li key={r.code} className="flex gap-2 text-caption text-fg">
                  <span className="orb-data w-8 shrink-0 text-right text-fg-muted">+{r.points}</span>
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-3.5 pb-3 pl-4">
        {buttons.map((b, i) => (
          <Button key={b.label} size="sm" variant={i === 0 && b.label !== "Ver rota" ? "primary" : "secondary"} icon={<span className="[&_svg]:size-3.5">{b.icon}</span>} onClick={b.run}>
            {b.label}
          </Button>
        ))}
        <Menu
          label={`Mais ações de ${item.title}`}
          trigger={<IconButton size="sm" label="Mais ações" icon={<Ellipsis className="size-4" />} className="ml-auto" />}
          items={[
            { label: "Abrir painel da viagem", icon: <PanelRightOpen />, onSelect: onOpen },
            ...tripActions.filter((a) => a.id !== "resolve" || !buttons.some((b) => b.label === "Resolver")).map((a) => ({ label: a.label, icon: a.icon, onSelect: a.run })),
          ]}
        />
      </div>
      {dialogs}
    </article>
  );
}
