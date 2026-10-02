// Relógio da simulação: tempo simulado absoluto (epoch ms) que avança com
// o tempo real × velocidade. Fonte de tempo e agendador injetáveis (testes).

export const SIMULATION_SPEEDS = [0.5, 1, 2, 5, 10] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

/** 1× = 1 minuto de operação por segundo real (60× o tempo de relógio). */
export const BASE_RATE = 60;

export interface TimeSource {
  now(): number;
  schedule(cb: () => void): unknown;
  cancel(handle: unknown): void;
}

export const browserTimeSource: TimeSource = {
  now: () => performance.now(),
  schedule: (cb) => requestAnimationFrame(cb),
  cancel: (h) => cancelAnimationFrame(h as number),
};

export interface ClockState {
  simTimeMs: number;
  playing: boolean;
  speed: SimulationSpeed;
}

export class SimulationClock {
  private state: ClockState;
  private lastReal = 0;
  private handle: unknown = null;
  private readonly listeners = new Set<(s: ClockState) => void>();

  constructor(
    startSimTimeMs: number,
    private readonly time: TimeSource = browserTimeSource
  ) {
    this.state = { simTimeMs: startSimTimeMs, playing: false, speed: 1 };
  }

  getState(): ClockState {
    return this.state;
  }

  subscribe(listener: (s: ClockState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  play() {
    if (this.state.playing) return;
    this.lastReal = this.time.now();
    this.set({ playing: true });
    this.loop();
  }

  pause() {
    if (this.handle !== null) this.time.cancel(this.handle);
    this.handle = null;
    this.set({ playing: false });
  }

  setSpeed(speed: SimulationSpeed) {
    this.set({ speed });
  }

  seek(simTimeMs: number) {
    this.lastReal = this.time.now();
    this.set({ simTimeMs });
  }

  /** Avança manualmente (usado pelo loop e por testes). */
  advance(realDeltaMs: number) {
    this.set({ simTimeMs: this.state.simTimeMs + realDeltaMs * BASE_RATE * this.state.speed });
  }

  dispose() {
    this.pause();
    this.listeners.clear();
  }

  private loop = () => {
    const now = this.time.now();
    this.advance(now - this.lastReal);
    this.lastReal = now;
    if (this.state.playing) this.handle = this.time.schedule(this.loop);
  };

  private set(patch: Partial<ClockState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l(this.state));
  }
}
