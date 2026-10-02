"use client";

import { useState, type ReactNode } from "react";
import {
  Ban,
  Check,
  Circle,
  CircleDot,
  Clock,
  Diamond,
  Inbox,
  OctagonAlert,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { statusSpec, type StatusEntity, type StatusGlyph, type StatusSpec, type StatusTone } from "@/lib/ui/status";

const GLYPH: Record<StatusGlyph, (p: { className?: string }) => ReactNode> = {
  moving: ({ className }) => (
    <span className={cn("relative grid place-items-center", className)}>
      <span className="size-2 rounded-full bg-current" />
    </span>
  ),
  done: ({ className }) => <Check className={className} strokeWidth={2.5} />,
  waiting: ({ className }) => <Clock className={className} strokeWidth={2.25} />,
  risk: ({ className }) => <TriangleAlert className={className} strokeWidth={2.25} />,
  idle: ({ className }) => <Circle className={className} strokeWidth={2.25} />,
  failed: ({ className }) => <X className={className} strokeWidth={2.5} />,
  planned: ({ className }) => <CircleDot className={className} strokeWidth={2.25} />,
  critical: ({ className }) => <OctagonAlert className={className} strokeWidth={2.25} />,
  issue: ({ className }) => <Diamond className={className} strokeWidth={2.5} />,
  returned: ({ className }) => <Undo2 className={className} strokeWidth={2.25} />,
  inbox: ({ className }) => <Inbox className={className} strokeWidth={2.25} />,
  blocked: ({ className }) => <Ban className={className} strokeWidth={2.25} />,
};

const ICON_TONE: Record<StatusTone, string> = {
  neutral: "text-neutral",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  critical: "text-critical",
  exception: "text-exception",
};
const TEXT_TONE: Record<StatusTone, string> = {
  neutral: "text-neutral-fg",
  info: "text-info-fg",
  success: "text-success-fg",
  warning: "text-warning-fg",
  danger: "text-danger-fg",
  critical: "text-critical",
  exception: "text-exception-fg",
};
const DOT_TONE: Record<StatusTone, string> = {
  neutral: "bg-neutral",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  critical: "bg-critical",
  exception: "bg-exception",
};
const BADGE_TONE: Record<StatusTone, string> = {
  neutral: "bg-neutral-subtle border-neutral-line text-neutral-fg",
  info: "bg-info-subtle border-info-line text-info-fg",
  success: "bg-success-subtle border-success-line text-success-fg",
  warning: "bg-warning-subtle border-warning-line text-warning-fg",
  danger: "bg-danger-subtle border-danger-line text-danger-fg",
  critical: "bg-critical border-critical text-critical-fg",
  exception: "bg-exception-subtle border-exception-line text-exception-fg",
};

export function StatusGlyphIcon({ glyph, tone, className }: { glyph: StatusGlyph; tone: StatusTone; className?: string }) {
  const G = GLYPH[glyph];
  return (
    <span aria-hidden className={cn("inline-grid shrink-0 place-items-center", tone === "critical" ? "" : ICON_TONE[tone])}>
      <G className={cn("size-3.5", className)} />
    </span>
  );
}

/**
 * Status: ícone + texto + cor. Nunca só cor.
 *  · variant="badge"  — pílula com fundo (listas, cabeçalhos)
 *  · variant="inline" — ícone + texto sem fundo (tabelas densas, timeline)
 * Ao mudar de valor, faz um único flash (motion de mudança de status).
 */
export function Status({
  entity,
  value,
  spec: specOverride,
  variant = "badge",
  size = "md",
  className,
}: {
  entity?: StatusEntity;
  value?: string;
  spec?: StatusSpec;
  variant?: "badge" | "inline";
  size?: "sm" | "md";
  className?: string;
}) {
  const spec = specOverride ?? statusSpec(entity!, value!);
  // Detecta mudança de valor entre renders (padrão "informação de render anterior").
  const [prev, setPrev] = useState(spec.label);
  const [flash, setFlash] = useState(0);
  if (prev !== spec.label) {
    setPrev(spec.label);
    setFlash((n) => n + 1);
  }
  const critical = spec.tone === "critical";
  return (
    <span
      key={flash}
      data-status-tone={spec.tone}
      className={cn(
        "inline-flex max-w-full items-center whitespace-nowrap font-medium",
        variant === "badge"
          ? cn("rounded-sm border", size === "sm" ? "h-5 gap-1 px-1.5 text-caption" : "h-6 gap-1.5 px-2 text-label", BADGE_TONE[spec.tone])
          : cn("gap-1.5", size === "sm" ? "text-caption" : "text-body-sm", TEXT_TONE[spec.tone]),
        flash > 0 && "animate-orb-status",
        className
      )}
    >
      {critical && variant === "badge" ? (
        <StatusGlyphIcon glyph={spec.glyph} tone="critical" className="text-critical-fg" />
      ) : (
        <StatusGlyphIcon glyph={spec.glyph} tone={spec.tone} />
      )}
      <span className="truncate">{spec.label}</span>
    </span>
  );
}

/** Ponto de estado para mapas e listas muito compactas (sempre com texto acessível). */
export function StatusDot({ tone, label, pulse }: { tone: StatusTone; label: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex size-2.5 shrink-0" role="img" aria-label={label}>
      {pulse && <span aria-hidden className={cn("absolute inset-0 rounded-full animate-orb-pulse", DOT_TONE[tone])} />}
      <span aria-hidden className={cn("relative size-2.5 rounded-full", DOT_TONE[tone])} />
    </span>
  );
}
