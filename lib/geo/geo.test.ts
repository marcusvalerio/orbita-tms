import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePolyline, encodePolyline } from "./polyline";
import { estimateRoute } from "./estimate";
import { simulate, snapStopsToPath, totalDurationSec, type RoutePlan } from "./simulation/engine";
import { SimulationClock, BASE_RATE, type TimeSource } from "./simulation/clock";
import { DemoTrackingProvider } from "./simulation/demo-tracking";
import { GoogleRoutesProvider, RouteProviderError } from "./google/routes";
import { GoogleGeocodingProvider, GeocodingProviderError } from "./google/geocoding";
import { CatalogGeocodingProvider } from "./catalog-geocoding";
import { TtlCache, RateLimiter, parseStops } from "./server/guards";
import { generateEmptyOperation } from "../sim/generate-empty";

const CD = { lat: -22.8105, lng: -43.362 };
const FREGUESIA = { lat: -22.9416, lng: -43.3431 };
const CAMPO_GRANDE = { lat: -22.9035, lng: -43.5591 };

// --- Polyline ------------------------------------------------------------------------

test("polyline: decodifica o exemplo oficial do Google", () => {
  const pts = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  assert.deepEqual(pts, [
    { lat: 38.5, lng: -120.2 },
    { lat: 40.7, lng: -120.95 },
    { lat: 43.252, lng: -126.453 },
  ]);
});

test("polyline: codificar → decodificar preserva o caminho", () => {
  const path = [CD, FREGUESIA, CAMPO_GRANDE];
  assert.deepEqual(decodePolyline(encodePolyline(path)), path);
});

// --- Estimativa ------------------------------------------------------------------------

test("estimativa: uma perna por par de paradas, caminho começa e termina nas paradas", () => {
  const r = estimateRoute([CD, FREGUESIA, CAMPO_GRANDE]);
  assert.equal(r.legs.length, 2);
  assert.equal(r.source, "estimate");
  assert.deepEqual(r.path[0], CD);
  assert.deepEqual(r.path.at(-1), CAMPO_GRANDE);
  assert.equal(r.distanceMeters, r.legs[0].distanceMeters + r.legs[1].distanceMeters);
});

// --- Motor de simulação -------------------------------------------------------------

function plan(): RoutePlan {
  const route = estimateRoute([CD, FREGUESIA, CAMPO_GRANDE]);
  return {
    shipmentId: "VIA-00001",
    vehicleId: "ORBT-014",
    departure: "2026-09-30T12:00:00.000Z",
    path: route.path,
    stopPathIndex: snapStopsToPath(route.path, [CD, FREGUESIA, CAMPO_GRANDE]),
    legDurationsSec: [1200, 1800],
    serviceSec: [0, 600, 600],
  };
}

test("simulação: t=0 está na origem, parada 1 em rota", () => {
  const s = simulate(plan(), 0);
  assert.deepEqual(s.position, CD);
  assert.deepEqual(s.stopProgress, ["Entregue", "Em rota", "Pendente"]);
  assert.equal(s.progress, 0);
  assert.equal(s.activeStopIndex, 1);
});

test("simulação: sequência Em rota → Chegou → Em descarga → Entregue → próxima parada", () => {
  const p = plan();
  assert.equal(simulate(p, 600).stopProgress[1], "Em rota");
  assert.equal(simulate(p, 1210).stopProgress[1], "Chegou");
  assert.equal(simulate(p, 1500).stopProgress[1], "Em descarga");
  const after = simulate(p, 1900);
  assert.equal(after.stopProgress[1], "Entregue");
  assert.equal(after.stopProgress[2], "Em rota");
  assert.equal(after.etaByStop[1], null);
});

test("simulação: durante o atendimento o veículo fica parado na parada", () => {
  const p = plan();
  const a = simulate(p, 1300);
  const b = simulate(p, 1700);
  assert.deepEqual(a.position, b.position);
  assert.equal(b.speedKmh, 0);
});

test("simulação: ETA da parada vem do plano e é estável ao longo do tempo", () => {
  const p = plan();
  const eta = simulate(p, 0).etaByStop[2];
  assert.equal(eta, "2026-09-30T13:00:00.000Z"); // saída 12:00 + 1200 + 600 + 1800 s
  assert.equal(simulate(p, 900).etaByStop[2], eta);
});

test("simulação: função pura — mesmo t, mesmo estado; progresso monotônico; fim = concluída", () => {
  const p = plan();
  assert.deepEqual(simulate(p, 1234), simulate(p, 1234));
  let last = -1;
  for (let t = 0; t <= totalDurationSec(p); t += 60) {
    const s = simulate(p, t);
    assert.ok(s.progress >= last);
    last = s.progress;
  }
  const end = simulate(p, 10 ** 6);
  assert.equal(end.finished, true);
  assert.equal(end.progress, 1);
  assert.deepEqual(end.stopProgress, ["Entregue", "Entregue", "Entregue"]);
});

// --- Relógio e rastreamento simulado ---------------------------------------------

function manualTime(): TimeSource & { tick(ms: number): void } {
  let now = 0;
  let pending: (() => void) | null = null;
  return {
    now: () => now,
    schedule: (cb) => ((pending = cb), 1),
    cancel: () => (pending = null),
    tick(ms) {
      now += ms;
      const cb = pending;
      pending = null;
      cb?.();
    },
  };
}

test("relógio: play/pause/velocidade avançam o tempo simulado corretamente", () => {
  const t = manualTime();
  const clock = new SimulationClock(0, t);
  clock.play();
  t.tick(1000); // 1 s real a 1× = BASE_RATE s simulados
  assert.equal(clock.getState().simTimeMs, 1000 * BASE_RATE);
  clock.setSpeed(10);
  t.tick(1000);
  assert.equal(clock.getState().simTimeMs, 1000 * BASE_RATE * 11);
  clock.pause();
  t.tick(1000);
  assert.equal(clock.getState().simTimeMs, 1000 * BASE_RATE * 11);
  clock.setSpeed(0.5);
  clock.play();
  t.tick(1000);
  assert.equal(clock.getState().simTimeMs, 1000 * BASE_RATE * 11.5);
});

test("rastreamento simulado: emite posições no contrato TrackingProvider e reinicia na saída", () => {
  const t = manualTime();
  const p = plan();
  const tracking = new DemoTrackingProvider(new Date(p.departure).getTime() + 1500 * 1000, t);
  const received: string[] = [];
  tracking.subscribe((positions) => received.push(positions[0].stopProgress[1]));
  tracking.setPlans([p]);
  assert.equal(tracking.getSnapshot()[0].source, "demo");
  assert.equal(tracking.getSnapshot()[0].stopProgress[1], "Em descarga");
  tracking.resetTo("VIA-00001");
  assert.equal(tracking.getSnapshot()[0].progress, 0);
  assert.deepEqual(received, ["Em descarga", "Em rota"]);
});

// --- Google Routes (fetch simulado) ------------------------------------------------

test("Google Routes: monta a requisição (chave no header, FieldMask, intermediárias) e interpreta a resposta", async () => {
  let captured: { url: string; init: RequestInit } | null = null;
  const fakeFetch = (async (url: string, init: RequestInit) => {
    captured = { url, init };
    return new Response(
      JSON.stringify({
        routes: [
          {
            distanceMeters: 68092,
            duration: "5445s",
            polyline: { encodedPolyline: encodePolyline([CD, FREGUESIA, CAMPO_GRANDE]) },
            legs: [{ distanceMeters: 25023, duration: "1983s" }, { distanceMeters: 43069, duration: "3462s" }],
          },
        ],
      }),
      { status: 200 }
    );
  }) as unknown as typeof fetch;

  const r = await new GoogleRoutesProvider("server-key", fakeFetch).computeRoute([CD, FREGUESIA, CAMPO_GRANDE]);
  const headers = captured!.init.headers as Record<string, string>;
  const body = JSON.parse(String(captured!.init.body));
  assert.equal(headers["X-Goog-Api-Key"], "server-key");
  assert.match(headers["X-Goog-FieldMask"], /routes\.polyline\.encodedPolyline/);
  assert.equal(body.intermediates.length, 1);
  assert.ok(!captured!.url.includes("server-key"), "a chave não vai na URL");
  assert.equal(r.source, "google-routes");
  assert.equal(r.durationSeconds, 5445);
  assert.equal(r.legs.length, 2);
  assert.equal(r.path.length, 3);
});

test("Google Routes: erro HTTP vira RouteProviderError (o endpoint cai para estimativa)", async () => {
  const fakeFetch = (async () => new Response("denied", { status: 403 })) as unknown as typeof fetch;
  await assert.rejects(new GoogleRoutesProvider("k", fakeFetch).computeRoute([CD, CAMPO_GRANDE]), RouteProviderError);
});

// --- Geocodificação ------------------------------------------------------------------

test("Google Geocoding: REQUEST_DENIED (ex.: cobrança desabilitada) vira erro tratável", async () => {
  const fakeFetch = (async () =>
    new Response(JSON.stringify({ status: "REQUEST_DENIED", error_message: "You must enable Billing" }))) as unknown as typeof fetch;
  await assert.rejects(new GoogleGeocodingProvider("k", fakeFetch).geocode("Av. das Américas"), GeocodingProviderError);
});

test("Google Geocoding: resultados mapeados e restritos ao Brasil na requisição", async () => {
  let url = "";
  const fakeFetch = (async (u: URL) => {
    url = String(u);
    return new Response(JSON.stringify({ status: "OK", results: [{ formatted_address: "Barra da Tijuca, RJ", geometry: { location: { lat: -23, lng: -43.36 } } }] }));
  }) as unknown as typeof fetch;
  const r = await new GoogleGeocodingProvider("k", fakeFetch).geocode("Barra");
  assert.match(url, /components=country%3ABR/);
  assert.equal(r[0].source, "google-geocoding");
});

test("catálogo: encontra locais cadastrados sem rede, ignorando acentos", async () => {
  const r = await new CatalogGeocodingProvider(generateEmptyOperation().locations).geocode("jacarepagua");
  assert.equal(r[0].source, "catalog");
  assert.match(r[0].label, /Freguesia/);
});

// --- Proteções dos endpoints ---------------------------------------------------------

test("guardas: só aceita 2..N coordenadas dentro do Brasil", () => {
  assert.equal(parseStops([CD], 27), null);
  assert.equal(parseStops([CD, { lat: 40.7, lng: -74 }], 27), null);
  assert.equal(parseStops([CD, "x"], 27), null);
  assert.deepEqual(parseStops([CD, CAMPO_GRANDE], 27), [CD, CAMPO_GRANDE]);
});

test("guardas: limite por cliente e cache com expiração", () => {
  let now = 0;
  const rl = new RateLimiter(2, 1000, () => now);
  assert.ok(rl.allow("a") && rl.allow("a"));
  assert.equal(rl.allow("a"), false);
  assert.ok(rl.allow("b"));
  now = 1500;
  assert.ok(rl.allow("a"));
  const cache = new TtlCache<number>(100, 10, () => now);
  cache.set("k", 1);
  assert.equal(cache.get("k"), 1);
  now += 200;
  assert.equal(cache.get("k"), undefined);
});

test("mapa esquemático: projeção usa a mesma unidade nos dois eixos (sem achatar)", async () => {
  const { mercatorY } = await import("./schematic/map-provider");
  // Perto do equador, 1° de latitude ≈ 1° de longitude na projeção.
  assert.ok(Math.abs(mercatorY(1) - mercatorY(0) - 1) < 0.01);
  // No Rio (-23°), a escala vertical é apenas ~9% maior (1/cos φ), não 57× menor.
  const dy = mercatorY(-22.9) - mercatorY(-23.0);
  assert.ok(dy > 0.1 && dy < 0.12);
});

test("splitPathAt divide a rota no ponto do veículo", async () => {
  const { splitPathAt } = await import("./polyline");
  const path = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 1 },
    { lat: 0, lng: 2 },
  ];
  const { done, remaining } = splitPathAt(path, { lat: 0.01, lng: 1.5 });
  assert.deepEqual(done, [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 0, lng: 1.5 }]);
  assert.deepEqual(remaining, [{ lat: 0, lng: 1.5 }, { lat: 0, lng: 2 }]);
});

test("lerpAngle gira pelo menor arco (sem volta completa)", async () => {
  const { lerpAngle } = await import("./polyline");
  assert.equal(lerpAngle(350, 10, 0.5), 0);
  assert.equal(lerpAngle(10, 350, 0.5), 0);
  assert.equal(lerpAngle(90, 180, 1), 180);
});
