"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { stagingLayout, type CargoItem, type PlacedBox, type Vehicle3D } from "@/lib/planning/cargo";
import { buildCargo, buildForklift, floorTexture, textSprite } from "./models";

// Cena: baú encostado na doca (piso do baú = piso da doca, y = 0), rua abaixo.
// Eixos: x = comprimento (0 = cabine, L = porta), z = largura, y = altura (cm).
// O pátio com as ruas A, B, C… fica na doca, depois da porta.
// A animação é controlada por um "tempo" t medido em volumes: o volume k está
// sendo levado quando k ≤ t < k + 1.

const DECK = 120; // altura do piso do baú em relação à rua
const YARD_GAP = 380; // distância porta → início das ruas
const LANE_COLORS = ["#facc15", "#38bdf8", "#4ade80", "#fb923c", "#c084fc", "#f472b6"];

export interface SceneControl {
  playing: boolean;
  speed: number;
  /** Incrementar para forçar um salto: t = seekTo.t. */
  seek: { t: number; n: number };
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

  useEffect(() => {
    cb.current = { onPick, onProgress };
    ctl.current = control;
  }, [onPick, onProgress, control]);

  useEffect(() => {
    tRef.current = control.seek.t;
  }, [control.seek]);

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
    scene.background = new THREE.Color(0xdfe5ea);
    scene.fog = new THREE.Fog(0xdfe5ea, 4000, 9000);

    const minZ = Math.min(-60, ...lanes.map((l) => l.z0)) - 150;
    const maxZ = Math.max(W + 60, ...lanes.map((l) => l.z1)) + 150;
    const maxX = Math.max(yardX + 400, ...lanes.map((l) => l.x1)) + 150;
    const center = new THREE.Vector3((-250 + maxX) / 2, 0, (minZ + maxZ) / 2);
    const span = Math.max(maxX + 250, maxZ - minZ);
    const radius = Math.hypot(maxX + 250, maxZ - minZ) / 2;

    const camera = new THREE.PerspectiveCamera(38, 1, 10, 30000);
    const viewDir = new THREE.Vector3(-0.25, 0.85, 0.75).normalize();
    const fit = () => {
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const dist = (radius * 0.68) / Math.sin(Math.min(vFov, hFov) / 2);
      camera.position.copy(center).addScaledVector(viewDir, dist);
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
    box(maxX + 3000, 2, maxZ - minZ + 3000, mat(0x4b5057), center.x, -DECK - 1, center.z, false);
    const dockLen = maxX - L + 200;
    box(dockLen, DECK, maxZ - minZ + 200, mat(0xb9bcbf), L + 6 + dockLen / 2, -DECK / 2, center.z, false);
    box(14, 30, W + 40, mat(0x1f2328), L + 2, -18, W / 2); // para-choque da doca
    box(6, 4, maxZ - minZ + 200, mat(0xf2c200), L + 10, 0.5, center.z, false); // faixa de borda

    // Baú
    box(L, 6, W, mat(0xffffff, { map: floorTexture(L, W) }), L / 2, -3, W / 2, false);
    const panel = mat(0xe9ecef, { roughness: 0.6, metalness: 0.2 });
    const glass = mat(0xe9ecef, { transparent: true, opacity: 0.16, roughness: 0.2, depthWrite: false });
    box(L, H, 4, panel, L / 2, H / 2, -2); // parede do fundo
    box(L, H, 4, glass, L / 2, H / 2, W + 2, false); // parede do lado da câmera: transparente
    box(4, H, W, panel, -2, H / 2, W / 2); // parede da cabine
    const ribs = mat(0xc4c9cf, { metalness: 0.4 });
    for (let x = 0; x <= L; x += 100) box(5, H, 3, ribs, x, H / 2, -4.5);
    box(L, 5, 6, ribs, L / 2, H, W + 2);
    box(L, 5, 6, ribs, L / 2, H, -2);
    // portas abertas
    const door = mat(0xdde1e5, { metalness: 0.2 });
    box(5, H, W / 2, door, L + 2, H / 2, -W / 4 - 4).rotation.y = Math.PI / 2;
    box(5, H, W / 2, door, L + 2, H / 2, W + W / 4 + 4).rotation.y = Math.PI / 2;
    // chassi e rodas
    box(L - 40, 25, W - 40, mat(0x222428), L / 2, -22, W / 2);
    const tire = mat(0x141414, { roughness: 0.95 });
    const rim = mat(0x9aa0a6, { metalness: 0.7, roughness: 0.3 });
    const axles = L > 1000 ? [L - 140, L - 260, L - 380] : [L - 160, L > 600 ? L - 280 : -1].filter((x) => x > 0);
    for (const ax of [...axles, -100])
      for (const z of [-6, W + 6]) {
        const w = add(new THREE.Mesh(new THREE.CylinderGeometry(50, 50, 28, 28), tire)) as THREE.Mesh;
        w.rotation.x = Math.PI / 2;
        w.position.set(ax, -DECK + 50, z);
        w.castShadow = true;
        const r = add(new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 30, 18), rim)) as THREE.Mesh;
        r.rotation.x = Math.PI / 2;
        r.position.copy(w.position);
      }
    // cabine
    const cabMat = mat(0x1d4ed8, { roughness: 0.4, metalness: 0.3 });
    box(190, 210, W, cabMat, -110, 35, W / 2);
    box(150, 70, W - 10, mat(0x0f172a, { roughness: 0.1, metalness: 0.5 }), -150, 85, W / 2);
    box(40, 40, W + 4, mat(0x111111), -200, -60, W / 2);

    // Ruas no pátio
    lanes.forEach((ln, i) => {
      const color = LANE_COLORS[i % LANE_COLORS.length];
      const line = mat(color, { roughness: 0.6 });
      const w = ln.x1 - ln.x0;
      const d = ln.z1 - ln.z0;
      box(w, 0.6, 6, line, ln.x0 + w / 2, 0.3, ln.z0, false);
      box(w, 0.6, 6, line, ln.x0 + w / 2, 0.3, ln.z1, false);
      box(6, 0.6, d, line, ln.x1, 0.3, ln.z0 + d / 2, false);
      const s = textSprite(`RUA ${ln.letter}`, `${ln.stop}ª entrega`, color);
      s.position.set(ln.x1 + 130, 70, ln.z0 + d / 2);
      add(s);
    });

    // Cargas
    const order = boxes.map((b) => ({ b, g: buildCargo(byId.get(b.itemId)!, b.dx, b.dy, b.dz), yard: slots.get(b.key)! }));
    cargoRef.current = order.map((o) => {
      o.g.userData.box = o.b;
      add(o.g);
      return o.g;
    });

    // Empilhadeira
    const fork = buildForklift();
    add(fork.group);
    const rest = new THREE.Vector3(L + 220, 0, W / 2);

    const center3 = (b: PlacedBox, p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x + b.dx / 2, p.y, p.z + b.dz / 2);
    const lerp = (a: THREE.Vector3, b: THREE.Vector3, u: number) => a.clone().lerp(b, Math.min(1, Math.max(0, u)));
    const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
    /** Caminho em segmentos com tempos relativos. */
    const path = (pts: THREE.Vector3[], u: number) => {
      const lens = pts.slice(1).map((p, i) => p.distanceTo(pts[i]) + 1);
      const tot = lens.reduce((s, x) => s + x, 0);
      let d = u * tot;
      for (let i = 0; i < lens.length; i++) {
        if (d <= lens[i]) return lerp(pts[i], pts[i + 1], ease(d / lens[i]));
        d -= lens[i];
      }
      return pts[pts.length - 1].clone();
    };

    let lastLoaded = -1;
    let lastDone = false;
    const apply = (t: number) => {
      const n = order.length;
      const k = Math.min(n, Math.max(0, Math.floor(t)));
      const u = t - k;
      let forkPos = rest.clone();
      let forkY = 0;
      order.forEach((o, i) => {
        const target = center3(o.b, o.b);
        const yard = center3(o.b, o.yard);
        if (i < k) o.g.position.copy(target);
        else if (i > k || k >= n) o.g.position.copy(yard);
        else {
          // fases: ir até a carga → levantar → levar até a porta → entrar → baixar → voltar
          const lift = Math.max(8, o.b.y + 6);
          const offX = o.b.dx / 2 + 6;
          const doorPt = new THREE.Vector3(L + offX + 140, lift, target.z);
          const pick = yard.clone();
          const pickUp = pick.clone().setY(Math.max(pick.y + 8, 8));
          if (u < 0.22) {
            const f = path([rest, new THREE.Vector3(pick.x + offX + 160, 0, pick.z), new THREE.Vector3(pick.x + offX, 0, pick.z)], u / 0.22);
            forkPos = f;
            forkY = Math.max(0, pick.y - 2);
            o.g.position.copy(yard);
          } else if (u < 0.3) {
            const v = (u - 0.22) / 0.08;
            o.g.position.copy(lerp(pick, pickUp, v));
            forkPos = new THREE.Vector3(pick.x + offX, 0, pick.z);
            forkY = o.g.position.y;
          } else if (u < 0.78) {
            const v = (u - 0.3) / 0.48;
            const p = path(
              [pickUp, new THREE.Vector3(pick.x + 160, pickUp.y, pick.z), new THREE.Vector3(doorPt.x, pickUp.y, doorPt.z), doorPt, new THREE.Vector3(target.x, lift, target.z)],
              v
            );
            o.g.position.copy(p);
            forkPos = new THREE.Vector3(p.x + offX, 0, p.z);
            forkY = p.y;
          } else if (u < 0.86) {
            const v = (u - 0.78) / 0.08;
            o.g.position.copy(lerp(new THREE.Vector3(target.x, lift, target.z), target, v));
            forkPos = new THREE.Vector3(target.x + offX, 0, target.z);
            forkY = o.g.position.y;
          } else {
            const v = (u - 0.86) / 0.14;
            o.g.position.copy(target);
            forkPos = path([new THREE.Vector3(target.x + offX, 0, target.z), new THREE.Vector3(doorPt.x, 0, target.z), rest], v);
            forkY = Math.max(0, o.b.y * (1 - v));
          }
        }
      });
      fork.group.position.copy(forkPos);
      fork.carriage.position.y = forkY;
      const loaded = Math.min(n, Math.floor(t));
      const done = t >= n;
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
    const SECONDS_PER_BOX = 2.4;
    const loop = () => {
      const dt = Math.min(clock.getDelta(), 0.1);
      const c = ctl.current;
      if (c.playing && tRef.current < order.length) tRef.current = Math.min(order.length, tRef.current + (dt * c.speed) / SECONDS_PER_BOX);
      apply(tRef.current);
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
