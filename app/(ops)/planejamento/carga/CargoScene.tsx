"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AISLE, stagingLayout, type CargoItem, type PlacedBox, type Vehicle3D } from "@/lib/planning/cargo";
import { buildForklift, buildUnit, textSprite } from "./models";
import { buildTruck } from "./truck";

// Cena: baú encostado na doca (piso do baú = piso da doca, y = 0), rua abaixo.
// Eixos: x = comprimento (0 = cabine, L = porta), z = largura, y = altura (cm).
// O pátio com as ruas A, B, C… fica na doca, depois da porta.
// A animação é controlada por um "tempo" t medido em volumes: o volume k está
// sendo levado quando k ≤ t < k + 1.

const DECK = 120; // altura do piso do baú em relação à rua
const YARD_GAP = 440; // distância porta → início das ruas (corredor da empilhadeira no meio)
const LANE_COLORS = ["#facc15", "#38bdf8", "#4ade80", "#fb923c", "#c084fc", "#f472b6"];

export interface SceneControl {
  playing: boolean;
  speed: number;
  /** Incrementar para forçar um salto: t = seekTo.t. */
  seek: { t: number; n: number };
  view: "3d" | "lateral" | "topo";
  /** Incrementar para o caminhão fechar as portas e sair da doca. */
  depart: number;
}

export function CargoScene({
  vehicle,
  boxes,
  items,
  selectedItemId,
  control,
  onPick,
  onProgress,
}: {
  vehicle: Vehicle3D;
  boxes: PlacedBox[];
  items: CargoItem[];
  selectedItemId: string | null;
  control: SceneControl;
  onPick: (box: PlacedBox | null) => void;
  onProgress: (loaded: number, done: boolean) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onPick, onProgress });
  const ctl = useRef(control);
  const cargoRef = useRef<THREE.Group[]>([]);
  const tRef = useRef(0);
  const setViewRef = useRef<(v: SceneControl["view"]) => void>(() => {});

  useEffect(() => {
    cb.current = { onPick, onProgress };
    ctl.current = control;
  }, [onPick, onProgress, control]);

  const seekRef = useRef<number | null>(control.seek.t);
  useEffect(() => {
    seekRef.current = control.seek.t;
  }, [control.seek]);

  useEffect(() => {
    setViewRef.current(control.view);
  }, [control.view]);

  // Destaque da carga selecionada (sem reconstruir a cena).
  useEffect(() => {
    for (const g of cargoRef.current) {
      const dim = !!selectedItemId && g.userData.box.itemId !== selectedItemId;
      g.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.opacity;
          m.transparent = dim || m.userData.baseOpacity < 1;
          m.opacity = dim ? 0.12 : m.userData.baseOpacity;
          m.depthWrite = !dim;
        }
      });
    }
  }, [selectedItemId, boxes]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const { length: L, width: W, height: H } = vehicle;
    const byId = new Map(items.map((i) => [i.id, i]));
    const yardX = L + YARD_GAP;
    const { slots, lanes } = stagingLayout(boxes, items, yardX, W / 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1eee8);
    scene.fog = new THREE.Fog(0xf1eee8, 4500, 10000);

    const minZ = Math.min(-60, ...lanes.map((l) => l.z0)) - 150;
    const maxZ = Math.max(W + 60, ...lanes.map((l) => l.z1 + AISLE)) + 100;
    const maxX = Math.max(yardX + 400, ...lanes.map((l) => l.x1)) + 150;
    const center = new THREE.Vector3((-250 + maxX) / 2, 0, (minZ + maxZ) / 2);
    const span = Math.max(maxX + 250, maxZ - minZ);
    const radius = Math.hypot(maxX + 250, maxZ - minZ) / 2;

    const camera = new THREE.PerspectiveCamera(38, 1, 10, 30000);
    const viewDir = new THREE.Vector3(-0.25, 0.85, 0.75).normalize();
    // Vistas: 3D (pátio + baú), lateral (corte do baú) e topo (planta do baú).
    let view: SceneControl["view"] = ctl.current.view;
    const fit = () => {
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const half = Math.min(vFov, hFov) / 2;
      if (view === "3d") {
        controls.target.copy(center);
        camera.position.copy(center).addScaledVector(viewDir, (radius * 0.68) / Math.sin(half));
      } else {
        // enquadra do para-choque dianteiro até as portas abertas
        const frontX = vehicle.axles.rearLabel === "Tandem traseiro" && vehicle.axles.frontLabel.startsWith("Cavalo") ? vehicle.axles.frontX - 420 : -260;
        const backX = L + W / 2 + 20;
        const truckCenter = new THREE.Vector3((frontX + backX) / 2, H / 2 - 30, W / 2);
        const r = (backX - frontX) / 2;
        const dist = (r / Math.tan(Math.atan(Math.tan(vFov / 2) * camera.aspect))) * 1.08;
        controls.target.copy(truckCenter);
        if (view === "lateral") camera.position.set(truckCenter.x, truckCenter.y + 40, W + dist);
        else camera.position.set(truckCenter.x, H + dist, W / 2 + 1);
      }
      controls.update();
    };
    setViewRef.current = (v) => {
      view = v;
      fit();
    };
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.08;
    controls.minDistance = 200;
    controls.maxDistance = span * 3;

    // Luz
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f96, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(center.x - 600, 2600, center.z + 1400);
    sun.target.position.copy(center);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -span * 0.7;
    sc.right = span * 0.7;
    sc.top = span * 0.7;
    sc.bottom = -span * 0.7;
    sc.near = 100;
    sc.far = 6000;
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target);

    const add = (o: THREE.Object3D) => (scene.add(o), o);
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, shadow = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      return add(m) as THREE.Mesh;
    };
    const mat = (color: THREE.ColorRepresentation, p: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...p });

    // Rua (asfalto) e doca (concreto)
    box(maxX + 3000, 2, maxZ - minZ + 3000, mat(0xd9d4cb), center.x, -DECK - 1, center.z, false);
    const dockLen = maxX - L + 200;
    box(dockLen, DECK, maxZ - minZ + 200, mat(0xf3f0ea), L + 6 + dockLen / 2, -DECK / 2, center.z, false);
    box(14, 30, W + 40, mat(0x1f2328), L + 2, -18, W / 2); // para-choque da doca
    box(6, 4, maxZ - minZ + 200, mat(0xf2c200), L + 10, 0.5, center.z, false); // faixa de borda

    // Caminhão (baú, chassi, rodas e cabine); chega de ré na doca ao montar a cena
    const truck = buildTruck(vehicle, DECK);
    add(truck);
    const truckDoors = truck.userData.doors as THREE.Group[];

    // Armazém: parede ao fundo com estantes porta-palete e portas de doca.
    const wallZ = minZ + 60;
    const wallLen = maxX - L + 100;
    box(wallLen, 520, 12, mat(0xfafaf8), L + wallLen / 2, 260 - 0.1, wallZ - 6);
    const rackBlue = mat(0x1e3a8a, { metalness: 0.4, roughness: 0.5 });
    const rackOrange = mat(0xf97316, { metalness: 0.3, roughness: 0.5 });
    const boxMat = mat(0xc79a5b);
    const rackZ = wallZ + 70;
    for (let x = L + 260; x < maxX - 120; x += 280) {
      for (const dx of [0, 270]) box(8, 420, 8, rackBlue, x + dx, 210, rackZ, true);
      for (const dx of [0, 270]) box(8, 420, 8, rackBlue, x + dx, 210, wallZ + 8, true);
      for (const y of [0, 140, 280, 410]) {
        box(270, 8, 6, rackOrange, x + 135, y + 4, rackZ, false);
        if (y < 400)
          for (let i = 0; i < 2; i++)
            box(115, 95 - ((x / 7 + i * 31 + y) % 25), 100, boxMat, x + 70 + i * 130, y + 8 + (95 - ((x / 7 + i * 31 + y) % 25)) / 2, (wallZ + rackZ) / 2, true);
      }
    }
    const frameMat = mat(0x22252a, { roughness: 0.6 });
    const doorPanel = mat(0xdfe3e8, { metalness: 0.3, roughness: 0.4 });
    // portas de doca vizinhas (fechadas) e a do caminhão (aberta)
    for (let i = -2; i <= 2; i++) {
      const zc = W / 2 + i * (W + 180);
      if (zc - W / 2 < minZ + 120 || zc + W / 2 > maxZ - 40) continue;
      box(18, H + 60, 18, frameMat, L + 14, (H + 60) / 2, zc - W / 2 - 22);
      box(18, H + 60, 18, frameMat, L + 14, (H + 60) / 2, zc + W / 2 + 22);
      box(18, 22, W + 62, frameMat, L + 14, H + 60, zc);
      if (i !== 0) box(6, H + 40, W + 30, doorPanel, L + 14, (H + 40) / 2, zc);
      box(20, 70, 16, mat(0xf2c200), L + 40, 35, zc - W / 2 - 50); // protetor amarelo
      box(20, 70, 16, mat(0xf2c200), L + 40, 35, zc + W / 2 + 50);
    }

    // Ruas no pátio
    lanes.forEach((ln, i) => {
      const color = LANE_COLORS[i % LANE_COLORS.length];
      const line = mat(color, { roughness: 0.6 });
      const w = ln.x1 - ln.x0;
      const d = ln.z1 - ln.z0;
      const fill = mat(color, { transparent: true, opacity: 0.18, depthWrite: false });
      box(w, 0.4, d, fill, ln.x0 + w / 2, 0.2, ln.z0 + d / 2, false);
      box(w, 0.6, 6, line, ln.x0 + w / 2, 0.3, ln.z0, false);
      box(w, 0.6, 6, line, ln.x0 + w / 2, 0.3, ln.z1, false);
      box(6, 0.6, d, line, ln.x1, 0.3, ln.z0 + d / 2, false);
      const s = textSprite(`RUA ${ln.letter}`, `${ln.stop}ª entrega`, color);
      s.position.set(ln.x1 + 130, 70, ln.z0 + d / 2);
      add(s);
    });

    // Paletes montados
    const order = boxes.map((b) => {
      const g = buildUnit(b, byId.get(b.itemId)!);
      g.userData.box = b;
      add(g);
      return { b, g, yard: slots.get(b.key)! };
    });
    cargoRef.current = order.map((o) => o.g);

    // ------------------------------------------------------------ empilhadeira
    // Roteiro de cada palete, como numa doca de verdade:
    // corredor → corredor da rua → vira de frente para o palete → entra com o garfo →
    // levanta → ré → volta ao corredor → alinha com a posição no baú → vira para a
    // porta → ergue até a altura certa → entra de frente → baixa → ré → baixa o garfo.
    // Convenção: garfo aponta para -x com yaw 0; frente = (-cos yaw, sin yaw).
    const fork = buildForklift();
    add(fork.group);
    const CX = L + 250;
    const REST = { x: CX, z: W / 2 };
    type Pose = { x: number; z: number; yaw: number; lift: number };
    type Phase = "antes" | "levando" | "depois";
    type Seg = { t0: number; dur: number; box: number; from: Pose; to: Pose; phase: Phase };
    const DRIVE = 240; // cm/s
    const TURN = Math.PI / 1.6; // rad/s
    const LIFT = 60; // cm/s
    const segs: Seg[] = [];
    const starts: number[] = [];
    let clockT = 0;
    let pose: Pose = { x: REST.x, z: REST.z, yaw: 0, lift: 0 };
    const angDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
    const push = (box: number, to: Pose, dur: number, phase: Phase) => {
      const d = Math.max(dur, 0.05);
      segs.push({ t0: clockT, dur: d, box, from: pose, to, phase });
      clockT += d;
      pose = to;
    };
    const turnTo = (box: number, yaw: number, phase: Phase) => {
      const d = angDiff(pose.yaw, yaw);
      if (Math.abs(d) > 0.01) push(box, { ...pose, yaw: pose.yaw + d }, Math.abs(d) / TURN + 0.1, phase);
    };
    const drive = (box: number, x: number, z: number, phase: Phase, reverse = false) => {
      const dist = Math.hypot(x - pose.x, z - pose.z);
      if (dist < 1) return;
      if (!reverse) turnTo(box, Math.atan2(z - pose.z, -(x - pose.x)), phase);
      push(box, { ...pose, x, z }, dist / DRIVE + 0.2, phase);
    };
    const lift = (box: number, h: number, phase: Phase) => push(box, { ...pose, lift: h }, Math.abs(h - pose.lift) / LIFT + 0.3, phase);

    order.forEach((o, k) => {
      starts.push(clockT);
      const b = o.b;
      const reach = b.dx / 2 + 6; // centro do palete à frente do mastro
      const lane = lanes.find((l) => l.stop === byId.get(b.itemId)!.stop)!;
      const tx = b.x + b.dx / 2;
      const tz = b.z + b.dz / 2;
      drive(k, CX, lane.aisleZ, "antes");
      drive(k, o.yard.x, lane.aisleZ, "antes");
      turnTo(k, -Math.PI / 2, "antes");
      drive(k, o.yard.x, o.yard.z + reach, "antes");
      lift(k, 12, "levando");
      drive(k, o.yard.x, lane.aisleZ, "levando", true);
      drive(k, CX, lane.aisleZ, "levando");
      drive(k, CX, tz, "levando");
      turnTo(k, 0, "levando");
      lift(k, b.y + 12, "levando");
      drive(k, tx + reach, tz, "levando");
      lift(k, b.y, "levando");
      drive(k, CX, tz, "depois", true);
      lift(k, 0, "depois");
      drive(k, REST.x, REST.z, "depois");
      turnTo(k, 0, "depois");
    });
    const total = clockT;
    starts.push(total);

    const easeIO = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
    const lerpN = (a: number, b: number, u: number) => a + (b - a) * u;
    let segIdx = 0;
    const poseAt = (t: number): { pose: Pose; seg: Seg | null } => {
      if (!segs.length || t >= total) return { pose: { x: REST.x, z: REST.z, yaw: 0, lift: 0 }, seg: null };
      if (segIdx >= segs.length || segs[segIdx].t0 > t) segIdx = 0;
      while (segIdx < segs.length - 1 && t >= segs[segIdx].t0 + segs[segIdx].dur) segIdx++;
      const sg = segs[segIdx];
      const u = easeIO(Math.min(1, Math.max(0, (t - sg.t0) / sg.dur)));
      return {
        pose: { x: lerpN(sg.from.x, sg.to.x, u), z: lerpN(sg.from.z, sg.to.z, u), yaw: lerpN(sg.from.yaw, sg.to.yaw, u), lift: lerpN(sg.from.lift, sg.to.lift, u) },
        seg: sg,
      };
    };

    // ------------------------------------------------- caminhão: chegada, portas e saída
    let arrive = 0; // 0 → 1 ao encostar na doca
    let departAt: number | null = null;
    const departSeen = ctl.current.depart;
    let doorAmt = 1; // 1 = fechada
    const easeOut = (u: number) => 1 - (1 - u) ** 3;
    const easeIn = (u: number) => u * u * u;

    let lastLoaded = -1;
    let lastDone = false;
    const apply = (t: number, now: number, dt: number) => {
      const n = order.length;
      const done = n > 0 && t >= total;
      // posição do caminhão
      let truckX = -(1 - easeOut(arrive)) * 2600;
      if (departAt !== null) {
        const d = Math.min(1, (now - departAt) / 2.4);
        truckX = -easeIn(Math.max(0, (d - 0.3) / 0.7)) * 3400;
      }
      truck.position.x = truckX;
      // portas: fechadas chegando, saindo ou com o carregamento concluído
      const wantClosed = arrive < 0.9 || departAt !== null || done;
      doorAmt = Math.min(1, Math.max(0, doorAmt + (wantClosed ? 1 : -1) * dt * 1.4));
      for (const d of truckDoors) d.rotation.y = d.userData.closed * easeIO(doorAmt);

      const { pose: p, seg } = poseAt(t);
      const k = seg ? seg.box : n;
      let loaded = 0;
      order.forEach((o, i) => {
        const inTruck = i < k || (i === k && seg?.phase === "depois");
        const carried = i === k && seg?.phase === "levando";
        if (inTruck) {
          loaded++;
          o.g.position.set(o.b.x + o.b.dx / 2 + truckX, o.b.y, o.b.z + o.b.dz / 2);
          o.g.rotation.y = 0;
        } else if (carried) {
          const reach = o.b.dx / 2 + 6;
          o.g.position.set(p.x - Math.cos(p.yaw) * reach, p.lift, p.z + Math.sin(p.yaw) * reach);
          o.g.rotation.y = p.yaw;
        } else {
          o.g.position.set(o.yard.x, 0, o.yard.z);
          o.g.rotation.y = -Math.PI / 2;
        }
      });
      fork.group.position.set(p.x, 0, p.z);
      fork.group.rotation.y = p.yaw;
      fork.carriage.position.y = p.lift;
      if (loaded !== lastLoaded || done !== lastDone) {
        lastLoaded = loaded;
        lastDone = done;
        cb.current.onProgress(loaded, done);
      }
    };

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    fit();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // Clique sem arrastar = seleção.
    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(cargoRef.current, true)[0];
      let o: THREE.Object3D | null = hit?.object ?? null;
      while (o && !o.userData.box) o = o.parent;
      cb.current.onPick(o ? (o.userData.box as PlacedBox) : null);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const clock = new THREE.Clock();
    let raf = 0;
    tRef.current = 0;
    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.1);
      const now = clock.elapsedTime;
      const c = ctl.current;
      // salto pedido pela tela (em paletes): converte para o tempo do roteiro
      if (seekRef.current !== null) {
        const idx = Math.max(0, Math.min(order.length, Math.round(seekRef.current)));
        tRef.current = starts[idx];
        seekRef.current = null;
      }
      if (c.depart !== departSeen && departAt === null) departAt = now;
      arrive = Math.min(1, arrive + dt / 2.8);
      // a empilhadeira só trabalha com o caminhão encostado e de portas abertas
      if (c.playing && arrive >= 1 && doorAmt <= 0.05 && tRef.current < total) tRef.current = Math.min(total, tRef.current + dt * c.speed);
      apply(tRef.current, now, dt);
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        }
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [vehicle, boxes, items]);

  return (
    <div
      ref={hostRef}
      className="h-full w-full"
      role="img"
      aria-label="Visualização 3D: baú na doca e ruas de separação. Arraste para girar, role para aproximar e clique numa carga para ver detalhes."
    />
  );
}
