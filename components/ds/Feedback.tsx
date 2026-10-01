"use client";

import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, LoaderCircle, X } from "lucide-react";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------- Spinner */

export function Spinner({ size = 14, className, label }: { size?: number; className?: string; label?: string }) {
  return (
    <LoaderCircle
      width={size}
      height={size}
      className={cn("animate-orb-spin shrink-0", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("orb-skeleton block h-3", className)} />;
}

/** Bloco de linhas fantasma para listas/tabelas em carregamento. */
export function SkeletonRows({ rows = 6, label = "Carregando" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="divide-y divide-line-subtle">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="w-20" />
          <Skeleton className="flex-1 max-w-64" />
          <Skeleton className="ml-auto w-16" />
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Estados de região */

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-1.5 px-4 py-6" : "gap-2 px-6 py-12", className)}>
      {icon && (
        <span aria-hidden className={cn("grid place-items-center rounded-full bg-surface-sunken text-fg-muted", compact ? "mb-1 size-8 [&_svg]:size-4" : "mb-2 size-10 [&_svg]:size-5")}>
          {icon}
        </span>
      )}
      <p className={cn("text-fg", compact ? "text-h3" : "text-h2")}>{title}</p>
      {description && <p className="max-w-sm text-body-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Não foi possível carregar.", description, action }: { title?: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span aria-hidden className="mb-2 grid size-10 place-items-center rounded-full bg-danger-subtle text-danger-fg">
        <CircleAlert className="size-5" />
      </span>
      <p className="text-h2 text-fg">{title}</p>
      {description && <p className="max-w-sm text-body-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Carregando…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 px-6 py-12 text-body-sm text-fg-muted">
      <Spinner />
      {label}
    </div>
  );
}

/* ---------------------------------------------------------------- Toast
   Região única anunciada por leitores de tela. Sucesso = polite; erro = assertive. */

export interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
  leaving?: boolean;
  action?: { label: string; onClick: () => void };
}

export function Toaster({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  const polite = toasts.filter((t) => t.tone !== "error");
  const assertive = toasts.filter((t) => t.tone === "error");
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--orb-bottom-nav-h)+12px)] z-[60] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-4 md:right-4 md:items-end">
      <div role="status" aria-live="polite" className="flex w-full flex-col items-center gap-2 md:items-end">
        {polite.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
      <div role="alert" aria-live="assertive" className="flex w-full flex-col items-center gap-2 md:items-end">
        {assertive.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const Icon = toast.tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      data-state={toast.leaving ? "closed" : "open"}
      className={cn(
        "orb-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-chrome py-2.5 pl-3 pr-2 text-body-sm text-chrome-fg shadow-3",
        toast.tone === "error" ? "border-danger" : "border-transparent"
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", toast.tone === "error" ? "text-chrome-danger" : "text-chrome-success")} />
      <p className="flex-1">{toast.message}</p>
      {toast.action && (
        <button type="button" onClick={toast.action.onClick} className="shrink-0 rounded-sm px-1.5 font-semibold text-chrome-fg underline underline-offset-2 hover:no-underline">
          {toast.action.label}
        </button>
      )}
      <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Fechar notificação" className="grid size-6 shrink-0 place-items-center rounded-sm text-chrome-muted hover:bg-chrome-hover hover:text-chrome-fg">
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
