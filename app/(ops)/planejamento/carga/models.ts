import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { CargoItem } from "@/lib/planning/cargo";

// Modelos 3D desenhados para o Órbita (unidade = 1 cm).
// Cada carga é um Group com origem no centro da base (y = 0 no piso).

const std = (color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------- texturas em canvas */

const texCache = new Map<string, THREE.Texture>();
function canvasTexture(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const hit = texCache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** Lateral de papelão com etiqueta colorida (cor da carga) e setas "este lado para cima". */
function cardboardSide(color: string, label: string, fragile: boolean) {
  return canvasTexture(`side-${color}-${label}-${fragile}`, 256, 256, (c) => {
    c.fillStyle = "#c79a5b";
    c.fillRect(0, 0, 256, 256);
    // fibra do papelão
    c.globalAlpha = 0.07;
    for (let i = 0; i < 256; i += 6) {
      c.fillStyle = i % 12 ? "#000" : "#fff";
      c.fillRect(0, i, 256, 2);
    }
    c.globalAlpha = 1;
    if (fragile) {
      c.fillStyle = "#d62828";
      c.fillRect(0, 96, 256, 64);
      c.fillStyle = "#fff";
      c.font = "bold 40px sans-serif";
      c.textAlign = "center";
      c.fillText("FRÁGIL", 128, 143);
    }
    // etiqueta
    c.fillStyle = "#fbfbf7";
    c.fillRect(150, 18, 92, 62);
    c.fillStyle = color;
    c.fillRect(150, 18, 92, 16);
    c.fillStyle = "#222";
    c.font = "bold 22px sans-serif";
    c.textAlign = "left";
    c.fillText(label, 158, 64);
    for (let i = 0; i < 8; i++) c.fillRect(158 + i * 9, 70, 4 + (i % 3), 6);
    // setas para cima
    c.strokeStyle = "#2b2b2b";
    c.lineWidth = 5;
    for (const x of [26, 52]) {
      c.beginPath();
      c.moveTo(x, 62);
      c.lineTo(x, 22);
      c.moveTo(x - 9, 33);
      c.lineTo(x, 20);
      c.lineTo(x + 9, 33);
      c.stroke();
    }
  });
}

function cardboardTop() {
  return canvasTexture("top", 256, 256, (c) => {
    c.fillStyle = "#c08f50";
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = "#a87a3f";
    c.fillRect(0, 126, 256, 4); // emenda das abas
    c.fillStyle = "rgba(235,215,170,0.85)"; // fita
    c.fillRect(0, 108, 256, 40);
  });
}

function woodTexture() {
  return canvasTexture("wood", 256, 64, (c) => {
    c.fillStyle = "#b78a55";
    c.fillRect(0, 0, 256, 64);
    c.strokeStyle = "rgba(90,55,20,0.35)";
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.moveTo(0, 6 + i * 7);
      c.bezierCurveTo(80, 2 + i * 7, 170, 12 + i * 7, 256, 5 + i * 7);
      c.stroke();
    }
  });
}

export function floorTexture(lengthCm: number, widthCm: number) {
  const t = canvasTexture("floor", 512, 128, (c) => {
    c.fillStyle = "#8b6a45";
    c.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? "#87653f" : "#93714b";
      c.fillRect(0, i * 16, 512, 15);
    }
  }).clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(lengthCm / 300, widthCm / 120);
  t.needsUpdate = true;
  return t;
}

export function textSprite(text: string, sub: string, color: string) {
  const t = canvasTexture(`lane-${text}-${sub}-${color}`, 512, 256, (c) => {
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(8, 8, 496, 240, 28);
    c.fill();
    c.fillStyle = "#111";
    c.font = "bold 110px sans-serif";
    c.textAlign = "center";
    c.fillText(text, 256, 125);
    c.font = "bold 62px sans-serif";
    c.fillText(sub, 256, 212);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(220, 110, 1);
  s.renderOrder = 10;
  return s;
}

/* ------------------------------------------------------------------ cargas */

function pallet(dx: number, dz: number) {
  const g = new THREE.Group();
  const wood = std(0xffffff, { map: woodTexture() });
  const h = 14;
  for (const z of [-dz / 2 + 5, 0, dz / 2 - 5]) g.add(mesh(new THREE.BoxGeometry(dx, 9, 10), wood, 0, 4.5, z));
  const slats = 7;
  for (let i = 0; i < slats; i++) {
    const x = -dx / 2 + 6 + (i * (dx - 12)) / (slats - 1);
    g.add(mesh(new THREE.BoxGeometry(11, 3, dz), wood, x, h - 1.5, 0));
  }
  return { group: g, height: h };
}

function cardboardBox(dx: number, dy: number, dz: number, item: CargoItem, fragile = false) {
  const side = std(0xffffff, { map: cardboardSide(item.color, item.id, fragile) });
  const top = std(0xffffff, { map: cardboardTop() });
  const plain = std(0xc79a5b);
  // ordem do BoxGeometry: +x, -x, +y, -y, +z, -z
  return mesh(new THREE.BoxGeometry(dx - 1, dy - 1, dz - 1), [side, side, top, plain, side, side] as unknown as THREE.Material, 0, dy / 2, 0);
}

export function buildCargo(item: CargoItem, dx: number, dy: number, dz: number): THREE.Group {
  const g = new THREE.Group();
  switch (item.kind) {
    case "palete": {
      const p = pallet(dx, dz);
      g.add(p.group);
      const loadH = dy - p.height;
      // fardos coloridos (cor da carga) sob filme stretch
      const nx = Math.max(1, Math.round(dx / 30));
      const nz = Math.max(1, Math.round(dz / 25));
      const ny = Math.max(1, Math.round(loadH / 25));
      const fx = (dx - 6) / nx;
      const fz = (dz - 6) / nz;
      const fy = loadH / ny;
      const packMat = std(item.color, { roughness: 0.5 });
      const packGeo = new RoundedBoxGeometry(fx - 2, fy - 2, fz - 2, 2, 3);
      const inst = new THREE.InstancedMesh(packGeo, packMat, nx * ny * nz);
      const m4 = new THREE.Matrix4();
      let k = 0;
      for (let ix = 0; ix < nx; ix++)
        for (let iy = 0; iy < ny; iy++)
          for (let iz = 0; iz < nz; iz++)
            inst.setMatrixAt(k++, m4.makeTranslation(-dx / 2 + 3 + fx * (ix + 0.5), p.height + fy * (iy + 0.5), -dz / 2 + 3 + fz * (iz + 0.5)));
      inst.castShadow = true;
      g.add(inst);
      const film = new THREE.MeshPhysicalMaterial({ color: 0xeef6ff, transparent: true, opacity: 0.32, roughness: 0.15, transmission: 0, clearcoat: 1 });
      g.add(mesh(new RoundedBoxGeometry(dx - 2, loadH, dz - 2, 3, 4), film, 0, p.height + loadH / 2, 0));
      break;
    }
    case "saco": {
      const p = pallet(dx, dz);
      g.add(p.group);
      const bagMat = std(0xe9dfc7, { roughness: 0.95 });
      const stripe = std(item.color, { roughness: 0.9 });
      const layers = Math.max(1, Math.round((dy - p.height) / 16));
      const bh = (dy - p.height) / layers;
      for (let l = 0; l < layers; l++) {
        // amarração cruzada: alterna o sentido dos sacos a cada camada
        const along = l % 2 === 0;
        const n = along ? 2 : 3;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < (along ? 3 : 2); j++) {
            const bx = along ? dx / 2 - 2 : dx / 3 - 2;
            const bz = along ? dz / 3 - 2 : dz / 2 - 2;
            const x = -dx / 2 + (bx + 2) * (i + 0.5);
            const z = -dz / 2 + (bz + 2) * (j + 0.5);
            const y = p.height + bh * (l + 0.5);
            g.add(mesh(new RoundedBoxGeometry(bx, bh - 1, bz, 3, Math.min(6, bh / 2 - 1)), bagMat, x, y, z));
            g.add(mesh(new THREE.BoxGeometry(along ? bx * 0.5 : 2, bh * 0.55, along ? 2 : bz * 0.5), stripe, x, y, z + (along ? bz / 2 : 0) + (along ? 0.2 : 0)));
          }
        }
      }
      break;
    }
    case "tambor": {
      const r = Math.min(dx, dz) / 2 - 1;
      const steel = std(item.color, { metalness: 0.6, roughness: 0.35 });
      const ringMat = std(0x3b3f45, { metalness: 0.7, roughness: 0.3 });
      g.add(mesh(new THREE.CylinderGeometry(r, r, dy - 2, 32), steel, 0, dy / 2, 0));
      for (const f of [0.08, 0.36, 0.64, 0.92]) {
        const ring = mesh(new THREE.TorusGeometry(r + 0.4, 1.3, 8, 40), ringMat, 0, dy * f, 0);
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
      }
      const lid = mesh(new THREE.CylinderGeometry(r - 2, r - 2, 1, 32), ringMat, 0, dy - 1, 0);
      g.add(lid);
      g.add(mesh(new THREE.CylinderGeometry(3, 3, 2, 12), std(0xd4a017, { metalness: 0.5 }), r * 0.5, dy, 0));
      break;
    }
    case "eletro": {
      // caixa branca de fábrica, cantoneiras de papelão e cintas
      const white = std(0xf4f4f1);
      const label = std(0xffffff, { map: cardboardSide(item.color, item.id, false) });
      const mats = [white, white, white, white, label, label];
      g.add(mesh(new THREE.BoxGeometry(dx - 1, dy - 1, dz - 1), mats as unknown as THREE.Material, 0, dy / 2, 0));
      const corner = std(0x9b7a4c);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(5, dy - 4, 5), corner, (sx * (dx - 3)) / 2, dy / 2, (sz * (dz - 3)) / 2));
      const strap = std(0x2f6fdb);
      for (const fy of [0.25, 0.75]) g.add(mesh(new THREE.BoxGeometry(dx + 0.6, 2.5, dz + 0.6), strap, 0, dy * fy, 0));
      break;
    }
    case "fragil":
      g.add(cardboardBox(dx, dy, dz, item, true));
      break;
    default:
      g.add(cardboardBox(dx, dy, dz, item));
  }
  return g;
}

/* ----------------------------------------------------------- empilhadeira */

export interface Forklift {
  group: THREE.Group;
  /** Carro dos garfos: mover em y. */
  carriage: THREE.Group;
}

/** Origem = base do mastro; garfos apontam para -x; corpo em +x. */
export function buildForklift(): Forklift {
  const group = new THREE.Group();
  const yellow = std(0xf2b705, { roughness: 0.5, metalness: 0.1 });
  const dark = std(0x26292e, { roughness: 0.6 });
  const steel = std(0x6d737b, { metalness: 0.7, roughness: 0.35 });
  const tire = std(0x151515, { roughness: 0.95 });

  // chassi e contrapeso
  group.add(mesh(new RoundedBoxGeometry(150, 45, 105, 3, 6), yellow, 90, 40, 0));
  group.add(mesh(new RoundedBoxGeometry(45, 75, 105, 3, 10), dark, 170, 60, 0));
  // banco e volante
  group.add(mesh(new THREE.BoxGeometry(40, 10, 50), dark, 115, 68, 0));
  group.add(mesh(new THREE.BoxGeometry(8, 45, 50), dark, 135, 90, 0));
  const wheel = mesh(new THREE.TorusGeometry(12, 2.2, 8, 24), dark, 60, 100, 0);
  wheel.rotation.z = Math.PI / 2.6;
  group.add(wheel);
  // gaiola de proteção
  for (const [x, z] of [
    [30, -48],
    [30, 48],
    [150, -48],
    [150, 48],
  ] as const)
    group.add(mesh(new THREE.BoxGeometry(5, 150, 5), dark, x, 140, z));
  group.add(mesh(new THREE.BoxGeometry(128, 5, 102), dark, 90, 214, 0));
  // rodas
  for (const [x, r] of [
    [35, 22],
    [150, 19],
  ] as const)
    for (const z of [-50, 50]) {
      const w = mesh(new THREE.CylinderGeometry(r, r, 18, 20), tire, x, r, z);
      w.rotation.x = Math.PI / 2;
      group.add(w);
    }
  // mastro
  for (const z of [-35, 35]) group.add(mesh(new THREE.BoxGeometry(8, 230, 8), steel, 8, 115, z));
  group.add(mesh(new THREE.BoxGeometry(8, 6, 78), steel, 8, 228, 0));
  // carro + garfos
  const carriage = new THREE.Group();
  carriage.add(mesh(new THREE.BoxGeometry(4, 45, 90), dark, 0, 22, 0));
  for (const z of [-28, 28]) carriage.add(mesh(new THREE.BoxGeometry(110, 4, 10), steel, -55, 2, z));
  group.add(carriage);
  return { group, carriage };
}
