import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Vehicle3D } from "@/lib/planning/cargo";
import { floorTexture } from "./models";

// Caminhões desenhados para o Órbita (unidade = 1 cm).
// Referencial do baú: piso em y = 0, x de 0 (parede da cabine) a L (porta),
// z de 0 (lado do fundo) a W (lado da câmera, transparente). A rua fica em y = -deck.

const std = (color: THREE.ColorRepresentation, p: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...p });

function put(g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

const M = {
  paint: std(0xf6f6f3, { roughness: 0.32, metalness: 0.15 }),
  accent: std(0x1d4ed8, { roughness: 0.35, metalness: 0.2 }),
  glass: std(0x1b2433, { roughness: 0.05, metalness: 0.7 }),
  black: std(0x1f2124, { roughness: 0.75 }),
  plastic: std(0x34373c, { roughness: 0.6 }),
  chrome: std(0xd7dadf, { roughness: 0.18, metalness: 0.95 }),
  steel: std(0x8a9097, { roughness: 0.35, metalness: 0.8 }),
  tire: std(0x161616, { roughness: 0.95 }),
  rim: std(0xbfc4ca, { roughness: 0.25, metalness: 0.85 }),
  head: std(0xfffbe8, { emissive: 0x8a7a3a, emissiveIntensity: 0.6, roughness: 0.1 }),
  amber: std(0xffa31a, { emissive: 0x7a4300, roughness: 0.3 }),
  red: std(0xd11a1a, { emissive: 0x5a0000, roughness: 0.3 }),
};

/* ---------------------------------------------------------------- texturas */

const cache = new Map<string, THREE.Texture>();
function tex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

/** Lateral do baú: painéis com rebites e faixa com a marca. */
function boxSideTexture(lengthCm: number, heightCm: number, brand: boolean) {
  const W = 2048;
  const H = Math.round((W * heightCm) / lengthCm);
  return tex(`side-${lengthCm}-${heightCm}-${brand}`, W, H, (c) => {
    c.fillStyle = "#f4f5f6";
    c.fillRect(0, 0, W, H);
    const step = (W * 60) / lengthCm; // painel a cada 60 cm
    for (let x = 0; x < W; x += step) {
      const g = c.createLinearGradient(x, 0, x + step, 0);
      g.addColorStop(0, "#e7e9ec");
      g.addColorStop(0.5, "#f7f8f9");
      g.addColorStop(1, "#e2e5e8");
      c.fillStyle = g;
      c.fillRect(x, 0, step, H);
      c.fillStyle = "#c9cdd2";
      c.fillRect(x, 0, 2, H);
      c.fillStyle = "#b5bac0";
      for (let y = 10; y < H; y += 26) c.fillRect(x - 1.5, y, 4, 4);
    }
    if (brand) {
      const y = H * 0.56;
      c.fillStyle = "#1d4ed8";
      c.fillRect(0, y, W, H * 0.07);
      c.fillStyle = "#f97316";
      c.fillRect(0, y + H * 0.075, W, H * 0.018);
      c.fillStyle = "#0f172a";
      c.font = `800 ${Math.round(H * 0.16)}px sans-serif`;
      c.textBaseline = "alphabetic";
      c.fillText("ÓRBITA", W * 0.06, y - H * 0.06);
      c.font = `600 ${Math.round(H * 0.07)}px sans-serif`;
      c.fillStyle = "#475569";
      c.fillText("TMS · logística inteligente", W * 0.06 + H * 0.02, y - H * 0.06 + H * 0.1 + H * 0.06);
    }
  });
}

function containerTexture(lengthCm: number, heightCm: number) {
  const W = 2048;
  const H = Math.round((W * heightCm) / lengthCm);
  return tex(`ctr-${lengthCm}`, W, H, (c) => {
    c.fillStyle = "#2f6f8f";
    c.fillRect(0, 0, W, H);
    const step = (W * 14) / lengthCm; // corrugado a cada 14 cm
    for (let x = 0; x < W; x += step) {
      const g = c.createLinearGradient(x, 0, x + step, 0);
      g.addColorStop(0, "#255a75");
      g.addColorStop(0.5, "#3a82a6");
      g.addColorStop(1, "#255a75");
      c.fillStyle = g;
      c.fillRect(x, H * 0.04, step, H * 0.92);
    }
    c.fillStyle = "#e8eef2";
    c.font = `700 ${Math.round(H * 0.1)}px monospace`;
    c.fillText("ORBU 204718 3", W * 0.04, H * 0.2);
  });
}

function grilleTexture() {
  return tex("grille", 256, 256, (c) => {
    c.fillStyle = "#1a1c1f";
    c.fillRect(0, 0, 256, 256);
    for (let y = 14; y < 256; y += 28) {
      const g = c.createLinearGradient(0, y, 0, y + 14);
      g.addColorStop(0, "#9aa1a9");
      g.addColorStop(1, "#4b5057");
      c.fillStyle = g;
      c.fillRect(8, y, 240, 12);
    }
  });
}

/* ------------------------------------------------------------------ rodas */

/** Roda com eixo em z. `dual` = rodado duplo. `outward` = sentido do lado de fora (+1 ou -1). */
function wheel(r: number, dual: boolean, outward: 1 | -1) {
  const g = new THREE.Group();
  const width = 26;
  const tires = dual ? [0, -outward * (width + 2)] : [0];
  for (const off of tires) {
    const t = put(g, new THREE.CylinderGeometry(r, r, width, 36), M.tire, 0, 0, off);
    t.rotation.x = Math.PI / 2;
    // ombro arredondado do pneu
    for (const s of [-1, 1]) {
      const sh = put(g, new THREE.TorusGeometry(r - 3, 3.2, 8, 36), M.tire, 0, 0, off + (s * width) / 2);
      sh.castShadow = false;
    }
  }
  // aro, cubo e porcas (lado de fora)
  const face = (outward * width) / 2;
  const rim = put(g, new THREE.CylinderGeometry(r * 0.6, r * 0.6, 2, 32), M.rim, 0, 0, face + outward * 0.6);
  rim.rotation.x = Math.PI / 2;
  const dish = put(g, new THREE.CylinderGeometry(r * 0.42, r * 0.5, 4, 24), M.steel, 0, 0, face + outward * 2.5);
  dish.rotation.x = Math.PI / 2;
  const hub = put(g, new THREE.CylinderGeometry(r * 0.16, r * 0.2, 8, 16), M.chrome, 0, 0, face + outward * 5);
  hub.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const n = put(g, new THREE.CylinderGeometry(1.6, 1.6, 4, 6), M.chrome, Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, face + outward * 4.5, false);
    n.rotation.x = Math.PI / 2;
  }
  return g;
}

function axle(g: THREE.Object3D, x: number, y: number, W: number, r: number, dual: boolean) {
  const left = wheel(r, dual, -1);
  left.position.set(x, y, -8);
  const right = wheel(r, dual, 1);
  right.position.set(x, y, W + 8);
  g.add(left, right);
  const shaft = put(g, new THREE.CylinderGeometry(6, 6, W, 12), M.black, x, y, W / 2, false);
  shaft.rotation.x = Math.PI / 2;
}

/** Para-lama em arco sobre a roda. */
function fender(g: THREE.Object3D, x: number, y: number, z: number, r: number, depth: number, mat: THREE.Material = M.black) {
  const geo = new THREE.CylinderGeometry(r + 8, r + 8, depth, 24, 1, true, -Math.PI / 2, Math.PI);
  const m = mat.clone();
  m.side = THREE.DoubleSide;
  const f = put(g, geo, m, x, y, z);
  f.rotation.x = Math.PI / 2;
}

/* ----------------------------------------------------------------- cabine */

/**
 * Cabine com frente em -x. `x0` = traseira da cabine, `floorY` = base, `W` = largura.
 * `tall` para cavalo mecânico (teto alto + defletor).
 */
function cab(g: THREE.Object3D, x0: number, floorY: number, W: number, h: number, tall: boolean) {
  const len = tall ? 230 : 185;
  const front = x0 - len;
  const cx = x0 - len / 2;
  // corpo
  put(g, new RoundedBoxGeometry(len, h, W, 4, 14), M.paint, cx, floorY + h / 2, W / 2);
  // teto alto / defletor
  if (tall) {
    put(g, new RoundedBoxGeometry(len * 0.7, 70, W - 6, 4, 18), M.paint, x0 - len * 0.35, floorY + h + 30, W / 2);
  }
  // para-brisa (inclinado) com moldura
  const ws = put(g, new RoundedBoxGeometry(4, h * 0.36, W - 26, 2, 2), M.glass, front - 1, floorY + h * 0.72, W / 2);
  ws.rotation.z = -0.12;
  put(g, new THREE.BoxGeometry(5, 6, W - 18), M.black, front - 2, floorY + h * 0.53, W / 2);
  // janelas laterais e friso das portas
  for (const z of [-0.6, W + 0.6]) {
    put(g, new RoundedBoxGeometry(len * 0.38, h * 0.3, 2, 2, 3), M.glass, front + len * 0.28, floorY + h * 0.72, z);
    put(g, new THREE.BoxGeometry(2, h * 0.62, 1.5), M.plastic, front + len * 0.55, floorY + h * 0.55, z + (z < 1 ? -0.4 : 0.4));
    put(g, new THREE.BoxGeometry(22, 3, 2.5), M.chrome, front + len * 0.48, floorY + h * 0.5, z + (z < 1 ? -0.8 : 0.8)); // maçaneta
    // faixa azul lateral
    put(g, new THREE.BoxGeometry(len - 30, 10, 1.2), M.accent, cx + 10, floorY + h * 0.36, z + (z < 1 ? -0.7 : 0.7));
    // degraus
    for (const [dy, dx] of [
      [18, 0],
      [42, 4],
    ])
      put(g, new THREE.BoxGeometry(36, 3, 14), M.steel, front + len * 0.42 + dx, floorY - 40 + dy, z + (z < 1 ? 4 : -4));
    // retrovisor com braço
    const side = z < 1 ? -1 : 1;
    put(g, new THREE.BoxGeometry(4, 4, 24), M.black, front + 14, floorY + h * 0.7, z + side * 12);
    put(g, new RoundedBoxGeometry(8, 44, 20, 2, 3), M.black, front + 14, floorY + h * 0.66, z + side * 28);
    put(g, new THREE.BoxGeometry(1, 38, 16), M.glass, front + 9.5, floorY + h * 0.66, z + side * 28, false);
  }
  // grade, faróis, para-choque, placa
  put(g, new THREE.BoxGeometry(3, h * 0.3, W * 0.6), std(0xffffff, { map: grilleTexture(), roughness: 0.4, metalness: 0.5 }), front - 1.5, floorY + h * 0.3, W / 2);
  put(g, new THREE.BoxGeometry(4, 6, W * 0.62), M.chrome, front - 2, floorY + h * 0.46, W / 2);
  for (const z of [22, W - 22]) {
    put(g, new RoundedBoxGeometry(4, 16, 34, 2, 3), M.head, front - 1.5, floorY + h * 0.2, z);
    put(g, new THREE.BoxGeometry(4, 6, 12), M.amber, front - 1.5, floorY + h * 0.2 - 13, z);
  }
  put(g, new RoundedBoxGeometry(22, 30, W + 8, 3, 6), M.plastic, front - 6, floorY - 6, W / 2);
  put(g, new THREE.BoxGeometry(2, 13, 40), std(0xffffff), front - 17.5, floorY - 4, W / 2);
  put(g, new THREE.BoxGeometry(2, 3.5, 40), M.accent, front - 17.6, floorY + 3, W / 2);
  // luzes de teto
  for (let i = -2; i <= 2; i++) put(g, new THREE.BoxGeometry(5, 4, 8), M.amber, front + 8, floorY + h + (tall ? 64 : 1), W / 2 + i * 22, false);
  return front;
}

/* ------------------------------------------------------------------- baú */

function cargoBox(g: THREE.Object3D, L: number, W: number, H: number, container: boolean) {
  const side = container
    ? std(0xffffff, { map: containerTexture(L, H), roughness: 0.55, metalness: 0.35 })
    : std(0xffffff, { map: boxSideTexture(L, H, true), roughness: 0.45, metalness: 0.15 });
  const plain = container ? std(0x2a6382, { roughness: 0.55, metalness: 0.35 }) : std(0xeef0f2, { roughness: 0.5, metalness: 0.1 });
  const frame = container ? std(0x24556f, { metalness: 0.4, roughness: 0.5 }) : std(0xb8bec5, { metalness: 0.75, roughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xe9ecef, transparent: true, opacity: 0.12, depthWrite: false, roughness: 0.2 });

  put(g, new THREE.BoxGeometry(L, 6, W), std(0xffffff, { map: floorTexture(L, W) }), L / 2, -3, W / 2, false);
  // parede do fundo (z = 0): textura por fora, lisa por dentro
  put(g, new THREE.BoxGeometry(L, H, 4), [plain, plain, plain, plain, plain, side] as unknown as THREE.Material, L / 2, H / 2, -2);
  // lado da câmera transparente (mostra a carga)
  put(g, new THREE.BoxGeometry(L, H, 3), glass, L / 2, H / 2, W + 1.5, false);
  // frente e teto (teto bem leve para não esconder a carga)
  put(g, new THREE.BoxGeometry(4, H, W), plain, -2, H / 2, W / 2);
  // perfis: cantos, topo e base
  for (const z of [-3, W + 3]) {
    put(g, new THREE.BoxGeometry(L + 6, 8, 6), frame, L / 2, H + 2, z);
    put(g, new THREE.BoxGeometry(L + 6, 10, 6), frame, L / 2, -4, z);
    put(g, new THREE.BoxGeometry(8, H + 12, 8), frame, -2, H / 2, z);
    put(g, new THREE.BoxGeometry(8, H + 12, 8), frame, L + 2, H / 2, z);
  }
  put(g, new THREE.BoxGeometry(8, 10, W + 12), frame, L + 2, H + 2, W / 2);
  put(g, new THREE.BoxGeometry(8, 10, W + 12), frame, -2, H + 2, W / 2);
  if (container) {
    for (const x of [-2, L + 2]) for (const z of [-3, W + 3]) for (const y of [-4, H + 2]) put(g, new THREE.BoxGeometry(14, 12, 14), std(0x1d4459, { metalness: 0.5 }), x, y, z, false);
  }
  // portas traseiras abertas (encostadas na lateral), com dobradiças e travas
  const doorMat = container ? plain : std(0xe8eaed, { roughness: 0.45, metalness: 0.2 });
  // folhas abertas a 90°, saindo da porta para trás, com travas e dobradiças
  for (const z of [-8, W + 8]) {
    const zOut = z < 0 ? -3 : 3;
    put(g, new THREE.BoxGeometry(W / 2, H, 4), doorMat, L + W / 4 + 6, H / 2, z);
    for (const fy of [0.15, 0.5, 0.85]) put(g, new THREE.BoxGeometry(12, 6, 4), M.steel, L + 8, H * fy, z + zOut, false);
    for (const fx of [0.35, 0.75]) put(g, new THREE.CylinderGeometry(1.8, 1.8, H - 10, 8), M.steel, L + 6 + (W / 2) * fx, H / 2, z + zOut, false);
  }
  // lanternas e para-choque traseiro
  for (const z of [10, W - 10]) {
    put(g, new RoundedBoxGeometry(5, 12, 26, 2, 2), M.red, L + 4, -28, z);
    put(g, new THREE.BoxGeometry(5, 8, 10), M.amber, L + 4, -28, z + (z < W / 2 ? 20 : -20));
  }
  put(g, new THREE.BoxGeometry(10, 12, W - 10), std(0xd71f1f, { roughness: 0.5 }), L - 12, -55, W / 2);
  for (let i = 0; i < 6; i++) put(g, new THREE.BoxGeometry(10.5, 12.5, (W - 10) / 12), std(0xffffff), L - 12, -55, 5 + ((W - 10) / 12) * (2 * i + 0.5) + (W - 10) / 24, false);
  // luzes de posição laterais
  for (let x = 60; x < L - 20; x += 150) put(g, new THREE.BoxGeometry(8, 4, 2), M.amber, x, -10, W + 4, false);
}

/* ---------------------------------------------------------------- montagem */

export function buildTruck(vehicle: Vehicle3D, deck: number): THREE.Group {
  const { length: L, width: W, height: H } = vehicle;
  const g = new THREE.Group();
  const isTrailer = vehicle.id === "carreta" || vehicle.id === "c20" || vehicle.id === "c40";
  const isContainer = vehicle.id === "c20" || vehicle.id === "c40";
  const r = isTrailer ? 52 : vehicle.id === "vuc" ? 40 : 50;
  const axleY = -deck + r;

  cargoBox(g, L, W, H, isContainer);

  // chassi: longarinas e travessas
  const railY = -22;
  const railFrom = isTrailer ? 0 : -260;
  for (const z of [W * 0.28, W * 0.72]) put(g, new THREE.BoxGeometry(L - railFrom - 20, 24, 10), M.black, (railFrom + L - 20) / 2, railY, z);
  for (let x = railFrom + 40; x < L - 20; x += 90) put(g, new THREE.BoxGeometry(8, 14, W * 0.44), M.black, x, railY, W / 2, false);

  if (!isTrailer) {
    // caminhão rígido: cabine, eixo dianteiro e eixo(s) traseiro(s)
    const cabFloor = -deck + r + 22;
    const cabH = H * 0.9 + 40;
    const front = cab(g, -14, cabFloor, W, cabH, false);
    const fx = front + 70;
    axle(g, fx, axleY, W, r, false);
    for (const z of [-8, W + 8]) fender(g, fx, axleY, z, r, 32, M.paint);
    const rearXs = vehicle.axles.rearLabel.startsWith("Tandem") ? [vehicle.axles.rearX - 65, vehicle.axles.rearX + 65] : [vehicle.axles.rearX];
    for (const ax of rearXs) axle(g, ax, axleY, W, r, true);
    for (const z of [-24, W + 24]) {
      const span = rearXs[rearXs.length - 1] - rearXs[0] + 2 * r + 30;
      put(g, new THREE.BoxGeometry(span, 4, 60), M.black, (rearXs[0] + rearXs[rearXs.length - 1]) / 2, axleY + r + 12, z + (z < 0 ? 16 : -16));
    }
    // tanque, caixa de bateria e protetor lateral
    const tank = put(g, new THREE.CylinderGeometry(26, 26, 110, 24), M.chrome, fx + 150, axleY + 12, -16);
    tank.rotation.z = Math.PI / 2;
    put(g, new THREE.BoxGeometry(60, 40, 40), M.black, fx + 150, axleY + 10, W + 14);
    const guardFrom = fx + r + 230;
    const guardTo = rearXs[0] - r - 20;
    if (guardTo > guardFrom)
      for (const y of [-48, -72]) put(g, new THREE.BoxGeometry(guardTo - guardFrom, 7, 3), M.steel, (guardFrom + guardTo) / 2, y, W + 12, false);
    // escapamento vertical atrás da cabine
    put(g, new THREE.CylinderGeometry(6, 6, cabH * 0.9, 12), M.chrome, -20, cabFloor + cabH * 0.55, -14);
  } else {
    // semirreboque: eixos traseiros triplos, pés de apoio e cavalo mecânico
    const center = vehicle.axles.rearX;
    for (const dx of [-135, 0, 135]) axle(g, center + dx, axleY, W, r, true);
    for (const z of [-24, W + 24]) put(g, new THREE.BoxGeometry(410, 4, 60), M.black, center, axleY + r + 12, z + (z < 0 ? 16 : -16));
    for (const z of [W * 0.2, W * 0.8]) {
      put(g, new THREE.BoxGeometry(10, deck - 40, 10), M.steel, 260, -deck / 2 - 10, z, false);
      put(g, new THREE.BoxGeometry(30, 4, 30), M.black, 260, -deck + 2, z);
    }
    put(g, new THREE.BoxGeometry(L - 600, 7, 3), M.steel, (330 + center - 220) / 2, -55, W + 12, false);
    // cavalo
    const tractor = new THREE.Group();
    g.add(tractor);
    const kingpin = vehicle.axles.frontX;
    const plateY = -38;
    put(tractor, new THREE.CylinderGeometry(42, 42, 10, 28), M.black, kingpin, plateY, W / 2); // 5ª roda
    for (const z of [W * 0.3, W * 0.7]) put(tractor, new THREE.BoxGeometry(560, 26, 10), M.black, kingpin - 210, plateY - 22, z);
    for (const dx of [-30, 100]) axle(tractor, kingpin + dx - 35, axleY, W, r, true);
    const cabFloor = -deck + r + 30;
    const front = cab(tractor, kingpin - 150, cabFloor, W, 230, true);
    const fx = front + 75;
    axle(tractor, fx, axleY, W, r, false);
    for (const z of [-8, W + 8]) fender(tractor, fx, axleY, z, r, 32, M.paint);
    for (const z of [-26, W + 26]) put(tractor, new THREE.BoxGeometry(210, 4, 58), M.black, kingpin + 35, axleY + r + 12, z + (z < 0 ? 16 : -16));
    const tank = put(tractor, new THREE.CylinderGeometry(30, 30, 120, 24), M.chrome, kingpin - 150 + 70, axleY + 12, -18);
    tank.rotation.z = Math.PI / 2;
    for (const z of [-10, W + 10]) put(tractor, new THREE.CylinderGeometry(7, 7, 300, 12), M.chrome, kingpin - 145, cabFloor + 180, z);
  }
  return g;
}
