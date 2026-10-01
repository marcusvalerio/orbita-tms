"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import type { StatusTone } from "@/lib/ui/status";
import { Checkbox } from "./Form";
import { EmptyState, SkeletonRows } from "./Feedback";

/* ---------------------------------------------------------------- SectionHeader */

export function SectionHeader({ title, count, actions, className, id }: { title: ReactNode; count?: number; actions?: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("flex min-h-9 items-center gap-2", className)}>
      <h2 id={id} className="text-h3 text-fg">
        {title}
      </h2>
      {count !== undefined && <span className="tabular text-body-sm text-fg-subtle">{count}</span>}
      {actions && <div className="ml-auto flex items-center gap-1.5">{actions}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="orb-data inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-line bg-surface px-1 text-caption text-fg-muted">{children}</kbd>;
}

/* ---------------------------------------------------------------- FilterChip / FilterBar
   Todo status é um filtro com contagem. */

const DOT: Record<StatusTone | "all", string> = {
  all: "bg-fg",
  neutral: "bg-neutral",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  critical: "bg-critical",
  exception: "bg-exception",
};

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count: number;
  tone?: StatusTone | "all";
  icon?: ReactNode;
}

export function FilterBar<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: FilterOption<T>[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("orb-scroll flex items-center gap-1.5 overflow-x-auto", className)}>
      {options.map((o) => (
        <FilterChip key={o.value} option={o} selected={o.value === value} onSelect={() => onChange(o.value)} />
      ))}
    </div>
  );
}

export function FilterChip<T extends string>({ option, selected, onSelect }: { option: FilterOption<T>; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-2 rounded-sm border px-2.5 text-body-sm font-medium",
        "transition-[background-color,border-color,color] duration-(--orb-duration-fast) ease-standard",
        selected ? "border-fg bg-fg text-fg-inverse" : "border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-hover",
        option.count === 0 && !selected && "text-fg-muted"
      )}
    >
      {option.icon ?? <span aria-hidden className={cn("size-2 rounded-full", DOT[option.tone ?? "all"], selected && option.tone === "all" && "bg-fg-inverse")} />}
      {option.label}
      <span className={cn("tabular", selected ? "text-fg-inverse/80" : "text-fg-muted")}>{option.count}</span>
    </button>
  );
}

/* ---------------------------------------------------------------- KeyValue / MetricGrid */

export function KeyValue({ label, value, mono, className }: { label: string; value: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-caption text-fg-muted">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-body text-fg", mono && "orb-data")}>{value ?? "—"}</dd>
    </div>
  );
}

export function MetricGrid({ items, columns = 2, className }: { items: { label: string; value: ReactNode; hint?: ReactNode; tone?: StatusTone; mono?: boolean }[]; columns?: 2 | 3 | 4; className?: string }) {
  const cols = columns === 4 ? "grid-cols-2 sm:grid-cols-4" : columns === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <dl className={cn("grid gap-px overflow-hidden rounded-md border border-line-subtle bg-line-subtle", cols, className)}>
      {items.map((m) => (
        <div key={m.label} className="min-w-0 bg-surface px-3 py-2.5">
          <dt className="text-caption text-fg-muted">{m.label}</dt>
          <dd
            className={cn(
              "mt-0.5 truncate text-h2 tabular",
              m.mono && "orb-data",
              m.tone === "danger" ? "text-danger-fg" : m.tone === "warning" ? "text-warning-fg" : m.tone === "success" ? "text-success-fg" : "text-fg"
            )}
          >
            {m.value ?? "—"}
          </dd>
          {m.hint && <p className="mt-0.5 truncate text-caption text-fg-subtle">{m.hint}</p>}
        </div>
      ))}
    </dl>
  );
}

/** KPI: valor + meta + definição. Sem tendência inventada (não há histórico). */
export function Kpi({ label, value, suffix, target, definition, tone }: { label: string; value: number | string | null; suffix?: string; target?: string; definition?: string; tone?: StatusTone }) {
  const empty = value === null;
  return (
    <div className="min-w-0" title={definition}>
      <p className="text-caption text-fg-muted">{label}</p>
      <p className={cn("text-h1 font-display tabular", empty ? "text-fg-disabled" : tone === "danger" ? "text-danger-fg" : tone === "warning" ? "text-warning-fg" : "text-fg")}>
        {empty ? "—" : value}
        {!empty && suffix && <span className="ml-0.5 text-body text-fg-muted">{suffix}</span>}
      </p>
      {target && <p className="text-caption text-fg-subtle">{target}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- Progress */

export function Progress({ value, label, tone = "info", className }: { value: number; label: string; tone?: "info" | "success" | "warning" | "danger" | "neutral"; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const bar = { info: "bg-info", success: "bg-success", warning: "bg-warning", danger: "bg-danger", neutral: "bg-fg" }[tone];
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className={cn("h-1.5 overflow-hidden rounded-full bg-surface-sunken", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-(--orb-duration-slow) ease-standard", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export type StopState = "done" | "active" | "pending" | "late" | "risk" | "issue";

/**
 * TripProgress: barra da viagem com um marcador por parada e o veículo
 * posicionado. A largura e as paradas concluídas animam com o tempo.
 */
export function TripProgress({
  progress,
  stops,
  startLabel,
  endLabel,
  startTime,
  endTime,
  compact,
  label = "Progresso da viagem",
}: {
  progress: number;
  stops: { at: number; state: StopState; title: string }[];
  startLabel?: string;
  endLabel?: string;
  startTime?: string;
  endTime?: string;
  compact?: boolean;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, progress * 100));
  const stopClass: Record<StopState, string> = {
    done: "bg-success border-success",
    active: "bg-surface border-info",
    pending: "bg-surface border-line-strong",
    late: "bg-surface border-danger",
    risk: "bg-surface border-warning",
    issue: "bg-exception border-exception",
  };
  return (
    <div className="min-w-0">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={`${Math.round(pct)}% · ${stops.filter((s) => s.state === "done").length} de ${stops.length} paradas concluídas`}
        className={cn("relative", compact ? "h-2.5" : "h-4")}
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-sunken" />
        <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-fg transition-[width] duration-(--orb-duration-slow) ease-standard" style={{ width: `${pct}%` }} />
        {stops.map((s, i) => (
          <span
            key={i}
            title={s.title}
            className={cn(
              "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors duration-(--orb-duration-base)",
              compact ? "size-2" : "size-2.5",
              stopClass[s.state],
              s.state === "active" && "ring-2 ring-info/25"
            )}
            style={{ left: `${s.at * 100}%` }}
          />
        ))}
        {!compact && (
          <span
            aria-hidden
            className="absolute top-1/2 grid size-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-fg shadow-1 transition-[left] duration-(--orb-duration-slow) ease-standard"
            style={{ left: `${pct}%` }}
          >
            <span className="size-1.5 rounded-full bg-brand" />
          </span>
        )}
      </div>
      {(startLabel || endLabel) && (
        <div className="mt-1.5 flex items-start justify-between gap-3 text-caption">
          <span className="min-w-0 truncate text-fg-muted">
            {startLabel} {startTime && <span className="orb-data text-fg">{startTime}</span>}
          </span>
          <span className="min-w-0 truncate text-right text-fg-muted">
            {endLabel} {endTime && <span className="orb-data text-fg">{endTime}</span>}
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Timeline */

export interface TimelineItem {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  time?: string;
  state: StopState | "event";
  marker?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}

/** Timeline vertical (paradas de uma viagem, histórico, atividade). */
export function Timeline({ items, label, className }: { items: TimelineItem[]; label: string; className?: string }) {
  const dot: Record<TimelineItem["state"], string> = {
    done: "bg-success border-success text-fg-inverse",
    active: "bg-surface border-info text-info-fg",
    pending: "bg-surface border-line-strong text-fg-muted",
    late: "bg-surface border-danger text-danger-fg",
    risk: "bg-surface border-warning text-warning-fg",
    issue: "bg-exception border-exception text-fg-inverse",
    event: "bg-surface border-line-strong text-fg-muted",
  };
  return (
    <ol aria-label={label} className={cn("relative", className)}>
      {items.map((it, i) => (
        <li key={it.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < items.length - 1 && (
            <span aria-hidden className={cn("absolute left-[11px] top-6 bottom-0 w-0.5 transition-colors duration-(--orb-duration-slow)", it.state === "done" ? "bg-success" : "bg-line-subtle")} />
          )}
          <span
            aria-hidden
            className={cn(
              "relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2 text-caption font-semibold transition-[background-color,border-color,color] duration-(--orb-duration-base)",
              dot[it.state],
              it.state === "active" && "shadow-[0_0_0_4px_color-mix(in_srgb,var(--orb-info)_18%,transparent)]"
            )}
          >
            {it.marker}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-body text-fg">{it.title}</div>
                {it.meta && <div className="text-caption text-fg-muted">{it.meta}</div>}
              </div>
              {(it.aside || it.time) && <div className="shrink-0 text-right text-caption">{it.aside ?? <span className="orb-data text-fg-muted">{it.time}</span>}</div>}
            </div>
            {it.children}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------------------------------------------------------------- AttentionMeter
   Nunca aparece sozinho: sempre ao lado do motivo em texto. */

export function AttentionMeter({ score, level }: { score: number; level: "critica" | "alta" | "media" | "baixa" }) {
  const color = { critica: "bg-critical", alta: "bg-danger", media: "bg-warning", baixa: "bg-neutral" }[level];
  const filled = Math.max(1, Math.round((score / 100) * 4));
  return (
    <span className="inline-flex items-center gap-1.5" aria-hidden>
      <span className="orb-data tabular text-body-sm font-semibold text-fg">{score}</span>
      <span className="flex gap-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-3 w-1 rounded-xs", i < filled ? color : "bg-line")} />
        ))}
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------- Distribution / HeatStrip */

export function DistributionBar({ segments, label }: { segments: { label: string; value: number; tone: StatusTone }[]; label: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div role="img" aria-label={`${label}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`} className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-surface-sunken">
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <span key={s.label} className={cn("h-full transition-[flex-grow] duration-(--orb-duration-slow)", DOT[s.tone])} style={{ flexGrow: s.value / total }} />
        ))}
    </div>
  );
}

/** Faixa horária: quantidade por hora em cada nível (ex.: janelas em risco nas próximas 6 h). */
export function HeatStrip({
  buckets,
  label,
}: {
  buckets: { hour: string; late: number; risk: number; ok: number }[];
  label: string;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.late + b.risk + b.ok));
  return (
    <figure className="min-w-0">
      <figcaption className="sr-only">{label}</figcaption>
      <div className="flex h-10 items-end gap-1">
        {buckets.map((b) => {
          const total = b.late + b.risk + b.ok;
          return (
            <div key={b.hour} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-px" title={`${b.hour}: ${b.late} atrasada(s), ${b.risk} em risco, ${b.ok} no prazo`}>
              {total === 0 && <span className="h-0.5 rounded-xs bg-line" />}
              {b.late > 0 && <span className="rounded-xs bg-danger" style={{ height: `${(b.late / max) * 100}%` }} />}
              {b.risk > 0 && <span className="rounded-xs bg-warning" style={{ height: `${(b.risk / max) * 100}%` }} />}
              {b.ok > 0 && <span className="rounded-xs bg-line-strong" style={{ height: `${(b.ok / max) * 100}%` }} />}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {buckets.map((b) => (
          <span key={b.hour} className="orb-data min-w-0 flex-1 text-center text-caption text-fg-subtle">
            {b.hour}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Hora</th>
            <th scope="col">Atrasadas</th>
            <th scope="col">Em risco</th>
            <th scope="col">No prazo</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.hour}>
              <th scope="row">{b.hour}</th>
              <td>{b.late}</td>
              <td>{b.risk}</td>
              <td>{b.ok}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/* ---------------------------------------------------------------- EntityRow
   Linha densa de entidade: ícone de tipo · ID · contexto · status · métrica. */

export function EntityRow({
  icon,
  id,
  title,
  meta,
  status,
  aside,
  selected,
  onClick,
  href,
  className,
}: {
  icon?: ReactNode;
  id?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  aside?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-brand" />}
      {icon && <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-sunken text-fg-muted [&_svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {id && <span className="orb-data shrink-0 text-body-sm font-medium text-fg">{id}</span>}
          <span className="truncate text-body-sm text-fg">{title}</span>
        </span>
        {meta && <span className="block truncate text-caption text-fg-muted">{meta}</span>}
      </span>
      {status && <span className="shrink-0">{status}</span>}
      {aside && <span className="shrink-0 text-right text-caption text-fg-muted">{aside}</span>}
    </>
  );
  const cls = cn(
    "relative flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-(--orb-duration-instant)",
    selected ? "bg-surface-selected" : "hover:bg-surface-hover",
    className
  );
  if (href) {
    return (
      <a href={href} className={cn(cls, "orb-focus-inset")} aria-current={selected || undefined}>
        {body}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(cls, "orb-focus-inset")} aria-pressed={selected}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

/* ---------------------------------------------------------------- DataTable
   Ferramenta operacional: ordenação, seleção, linha ativa, sticky header,
   paginação, teclado (↑/↓/Enter), estados e versão em cartões no mobile. */

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  width?: string;
  /** Esconde a coluna abaixo deste breakpoint (a informação vai para o cartão mobile). */
  hideBelow?: "md" | "lg" | "xl";
  mono?: boolean;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  label,
  onRowClick,
  activeKey,
  selectable,
  selected,
  onSelectedChange,
  rowActions,
  card,
  empty,
  loading,
  pageSize = 50,
  defaultSort,
  density = "compact",
  newKeys,
  className,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  label: string;
  onRowClick?: (row: T) => void;
  activeKey?: string | null;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (keys: Set<string>) => void;
  rowActions?: (row: T) => ReactNode;
  /** Renderização em cartão para telas < md. Sem ela, a tabela rola horizontalmente. */
  card?: (row: T) => ReactNode;
  empty?: ReactNode;
  loading?: boolean;
  pageSize?: number;
  defaultSort?: { id: string; dir: "asc" | "desc" };
  density?: "compact" | "comfortable";
  /** Linhas recém-inseridas (animação de entrada). */
  newKeys?: Set<string>;
  className?: string;
}) {
  const [sort, setSort] = useState(defaultSort ?? null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      return va < vb ? -dir : va > vb ? dir : 0;
    });
  }, [rows, columns, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize);
  const hide = { md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" };
  const rowH = density === "compact" ? "h-9" : "h-11";
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selected?.has(rowKey(r)));
  const someSelected = selectable && rows.some((r) => selected?.has(rowKey(r)));

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectedChange?.(next);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (e.key === "Enter" && onRowClick) {
      e.preventDefault();
      onRowClick(row);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const target = (e.key === "ArrowDown" ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling) as HTMLElement | null;
      target?.focus();
    } else if (e.key === " " && selectable) {
      e.preventDefault();
      toggle(rowKey(row));
    }
  };

  if (loading) return <SkeletonRows rows={8} label={`Carregando ${label}`} />;
  if (rows.length === 0) return <>{empty ?? <EmptyState compact title="Nada por aqui." />}</>;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* Mobile: cartões */}
      {card && (
        <ul aria-label={label} className="divide-y divide-line-subtle md:hidden">
          {visible.map((row) => {
            const key = rowKey(row);
            return (
              <li key={key} className={cn(newKeys?.has(key) && "orb-row-new")}>
                {onRowClick ? (
                  <button type="button" onClick={() => onRowClick(row)} className={cn("orb-focus-inset block w-full px-4 py-3 text-left", activeKey === key ? "bg-surface-selected" : "active:bg-surface-hover")}>
                    {card(row)}
                  </button>
                ) : (
                  <div className="px-4 py-3">{card(row)}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className={cn("orb-scroll min-h-0 flex-1 overflow-auto", card && "hidden md:block")}>
        <table className="w-full border-separate border-spacing-0 text-body-sm">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="sticky top-0 z-10 w-10 border-b border-line bg-surface px-3 text-left">
                  <Checkbox checked={!!allSelected} indeterminate={!allSelected && someSelected} onChange={(v) => onSelectedChange?.(v ? new Set(rows.map(rowKey)) : new Set())} label="Selecionar todas as linhas" />
                </th>
              )}
              {columns.map((c) => {
                const active = sort?.id === c.id;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                    style={{ width: c.width }}
                    className={cn(
                      "sticky top-0 z-10 h-9 whitespace-nowrap border-b border-line bg-surface px-3 text-label font-medium text-fg-muted",
                      c.align === "right" ? "text-right" : "text-left",
                      c.hideBelow && hide[c.hideBelow]
                    )}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => setSort(active && sort!.dir === "asc" ? { id: c.id, dir: "desc" } : { id: c.id, dir: "asc" })}
                        className={cn("-mx-1 inline-flex items-center gap-1 rounded-xs px-1 hover:text-fg", active && "text-fg")}
                      >
                        {c.header}
                        {active ? sort!.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
              {rowActions && (
                <th scope="col" className="sticky top-0 z-10 w-12 border-b border-line bg-surface px-3">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const key = rowKey(row);
              const isActive = activeKey === key;
              const isSelected = selected?.has(key);
              return (
                <tr
                  key={key}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-selected={selectable ? !!isSelected : isActive || undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={(e) => onKey(e, row)}
                  className={cn(
                    "group orb-focus-inset transition-colors duration-(--orb-duration-instant)",
                    onRowClick && "cursor-pointer",
                    isActive ? "bg-surface-selected" : isSelected ? "bg-surface-hover" : "hover:bg-surface-hover",
                    newKeys?.has(key) && "orb-row-new"
                  )}
                >
                  {selectable && (
                    <td className={cn("relative border-b border-line-subtle px-3", rowH)}>
                      {isActive && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-brand" />}
                      <Checkbox checked={!!isSelected} onChange={() => toggle(key)} label={`Selecionar ${key}`} />
                    </td>
                  )}
                  {columns.map((c, ci) => (
                    <td
                      key={c.id}
                      className={cn(
                        "relative whitespace-nowrap border-b border-line-subtle px-3 text-fg",
                        rowH,
                        c.align === "right" && "text-right",
                        c.mono && "orb-data",
                        c.hideBelow && hide[c.hideBelow]
                      )}
                    >
                      {ci === 0 && !selectable && isActive && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-brand" />}
                      {c.cell(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className={cn("border-b border-line-subtle px-2 text-right", rowH)} onClick={(e) => e.stopPropagation()}>
                      <span className="opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:group-aria-selected:opacity-100">{rowActions(row)}</span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label={`Paginação de ${label}`} className="flex items-center justify-between gap-3 border-t border-line-subtle px-4 py-2 text-caption text-fg-muted">
          <span className="tabular">
            {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} de {sorted.length}
          </span>
          <span className="flex items-center gap-1">
            <button type="button" aria-label="Página anterior" disabled={current === 0} onClick={() => setPage(current - 1)} className="grid size-7 place-items-center rounded-sm hover:bg-surface-hover disabled:opacity-40">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <span className="tabular">
              {current + 1} / {pages}
            </span>
            <button type="button" aria-label="Próxima página" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="grid size-7 place-items-center rounded-sm hover:bg-surface-hover disabled:opacity-40">
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </span>
        </nav>
      )}
    </div>
  );
}

