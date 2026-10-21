import { simulate, type RoutePlan, type SimulationState } from "./engine";
import { SimulationClock, type TimeSource, browserTimeSource } from "./clock";
import type { TrackingProvider } from "../types";

/**
 * Rastreamento simulado: posições derivadas do motor de simulação a partir
 * de um relógio compartilhado — todos os veículos andam no mesmo tempo.
 * Implementa o mesmo contrato que um rastreamento real (GPS ou Google Fleet
 * Engine) implementará; a interface não distingue a fonte além de `source`.
 */
export class DemoTrackingProvider implements TrackingProvider {
  readonly clock: SimulationClock;
  private plans: RoutePlan[] = [];
  private snapshot: SimulationState[] = [];
  private readonly listeners = new Set<(positions: SimulationState[]) => void>();

  constructor(startSimTimeMs: number, time: TimeSource = browserTimeSource) {
    this.clock = new SimulationClock(startSimTimeMs, time);
    this.clock.subscribe(() => this.recompute());
  }

  setPlans(plans: RoutePlan[]) {
    this.plans = plans;
    this.recompute();
  }

  subscribe(listener: (positions: SimulationState[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): SimulationState[] {
    return this.snapshot;
  }

  /** Reinicia a simulação para a saída de uma viagem (ou da mais antiga). */
  resetTo(shipmentId?: string) {
    const plan = this.plans.find((p) => p.shipmentId === shipmentId) ?? this.plans[0];
    if (plan) this.clock.seek(new Date(plan.departure).getTime());
  }

  dispose() {
    this.clock.dispose();
    this.listeners.clear();
  }

  private recompute() {
    const { simTimeMs } = this.clock.getState();
    this.snapshot = this.plans.map((p) => simulate(p, (simTimeMs - new Date(p.departure).getTime()) / 1000));
    this.listeners.forEach((l) => l(this.snapshot));
  }
}
