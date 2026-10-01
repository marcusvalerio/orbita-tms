import type { TripReading } from "./trip";

// Horizonte operacional: paradas ainda não atendidas por hora de chegada
// prevista (ETA), separadas em atrasadas, em risco e no prazo. Mostra o que
// vai acontecer nas próximas horas — não só o que já aconteceu.

export interface HorizonBucket {
  hour: string;
  startMs: number;
  late: number;
  risk: number;
  ok: number;
}

export function horizon(trips: Iterable<TripReading>, nowMs: number, hours = 6): { buckets: HorizonBucket[]; late: number; risk: number; ok: number } {
  const start = Math.floor(nowMs / 3600000) * 3600000;
  const buckets: HorizonBucket[] = Array.from({ length: hours }, (_, i) => {
    const t = start + i * 3600000;
    return {
      hour: `${new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", timeZone: "America/Sao_Paulo" }).slice(0, 2)}h`,
      startMs: t,
      late: 0,
      risk: 0,
      ok: 0,
    };
  });
  for (const trip of trips) {
    for (const st of trip.stops) {
      if (st.index === 0 || st.state === "done" || !st.eta) continue;
      const idx = Math.floor((new Date(st.eta).getTime() - start) / 3600000);
      if (idx < 0 || idx >= hours) continue;
      const b = buckets[idx];
      if (st.delayMin > 0) b.late++;
      else if (st.state === "risk") b.risk++;
      else b.ok++;
    }
  }
  return {
    buckets,
    late: buckets.reduce((n, b) => n + b.late, 0),
    risk: buckets.reduce((n, b) => n + b.risk, 0),
    ok: buckets.reduce((n, b) => n + b.ok, 0),
  };
}
