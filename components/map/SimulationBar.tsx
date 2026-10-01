"use client";

import { useEffect } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useLive } from "@/components/live/LiveOperation";
import { SIMULATION_SPEEDS, BASE_RATE } from "@/lib/geo/simulation/clock";
import { cn } from "@/lib/ui/cn";

/**
 * Controles da simulação (PLAY · PAUSE · RESET · 0,5×–10×). O relógio é o da
 * operação ao vivo: o mesmo para mapa, painéis e fila de atenção.
 * Espaço alterna play/pause quando nenhum campo está em foco.
 */
export function SimulationBar({ resetId, compact, className }: { resetId?: string | null; compact?: boolean; className?: string }) {
  const { tracking, clock, trackedIds } = useLive();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " || e.repeat) return;
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select,button,[role=dialog],[contenteditable=true],a")) return;
      e.preventDefault();
      if (tracking.clock.getState().playing) tracking.clock.pause();
      else tracking.clock.play();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tracking]);

  if (!clock || trackedIds.length === 0) return null;
  const time = new Date(clock.simTimeMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const date = new Date(clock.simTimeMs).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

  return (
    <div
      role="group"
      aria-label="Controles da simulação"
      className={cn("flex items-center gap-1 rounded-md border border-line-subtle bg-surface p-1 shadow-2", compact ? "text-caption" : "text-body-sm", className)}
    >
      <span className="flex items-center gap-1.5 px-2 text-caption font-medium text-fg-muted">
        <span aria-hidden className={cn("size-1.5 rounded-full", clock.playing ? "animate-orb-pulse bg-success" : "bg-fg-subtle")} />
        <span className={compact ? "sr-only" : "sr-only xl:not-sr-only"}>Simulação</span>
      </span>
      <button
        type="button"
        onClick={() => (clock.playing ? tracking.clock.pause() : tracking.clock.play())}
        aria-label={clock.playing ? "Pausar simulação" : "Iniciar simulação"}
        aria-keyshortcuts="Space"
        className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-primary px-2.5 font-medium text-primary-fg transition-colors hover:bg-primary-hover"
      >
        {clock.playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        <span className={compact ? "sr-only" : "hidden sm:inline"}>{clock.playing ? "Pausar" : "Iniciar"}</span>
      </button>
      <button
        type="button"
        onClick={() => tracking.resetTo(resetId ?? undefined)}
        aria-label="Reiniciar simulação da rota selecionada"
        className="grid size-8 place-items-center rounded-sm text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
      >
        <RotateCcw className="size-4" aria-hidden />
      </button>
      <span aria-hidden className="mx-0.5 h-5 w-px bg-line-subtle" />
      <div role="radiogroup" aria-label="Velocidade" className="flex items-center">
        {SIMULATION_SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            role="radio"
            aria-checked={clock.speed === speed}
            onClick={() => tracking.clock.setSpeed(speed)}
            className={cn(
              "orb-data h-8 rounded-sm px-1.5 text-caption font-medium transition-colors sm:px-2",
              clock.speed === speed ? "bg-surface-sunken text-fg" : "text-fg-muted hover:text-fg"
            )}
          >
            {speed.toLocaleString("pt-BR")}×
          </button>
        ))}
      </div>
      <span aria-hidden className="mx-0.5 h-5 w-px bg-line-subtle" />
      <span className="flex flex-col px-2 leading-tight" title={`1× = ${BASE_RATE / 60} min de operação por segundo`}>
        <span className="orb-data text-body-sm font-medium text-fg">{time}</span>
        {!compact && <span className="orb-data hidden text-caption text-fg-subtle 2xl:block">{date}</span>}
      </span>
    </div>
  );
}
