// Planejador de carga 3D (demonstrativo).
// Eixos do baú: x = comprimento (0 = cabine, L = porta), y = altura, z = largura.
// Regra de prioridade: ordem de entrega — a 1ª parada entra por último e fica
// junto à porta; a última parada vai para o fundo (cabine).
// Só entram os itens marcados para carregar; nada é aplicado automaticamente.

export type CargoKind = "caixa" | "palete" | "tambor" | "eletro" | "fragil" | "saco";

export interface CargoItem {
  id: string;
  name: string;
  kind: CargoKind;
  description: string;
  customer: string;
  /** Ordem de entrega (1 = primeira parada). */
  stop: number;
  /** Dimensões em cm: comprimento × largura × altura. */
  length: number;
  width: number;
  height: number;
  weightKg: number;
  quantity: number;
  stackable: boolean;
  color: string;
}

export interface Vehicle3D {
  id: string;
  name: string;
  length: number;
  width: number;
  height: number;
  maxWeightKg: number;
}

export interface PlacedBox {
  key: string;
  itemId: string;
  unit: number;
  x: number;
  y: number;
  z: number;
  /** Dimensões já rotacionadas: dx (comprimento), dy (altura), dz (largura). */
  dx: number;
  dy: number;
  dz: number;
}

export interface PackResult {
  placed: PlacedBox[];
  unplaced: { itemId: string; count: number; reason: string }[];
  volumeUsedM3: number;
  volumeTotalM3: number;
  weightKg: number;
  occupancyPercent: number;
  weightPercent: number;
}

export const VEHICLES: Vehicle3D[] = [
  { id: "vuc", name: "VUC (baú 4,2 m)", length: 420, width: 210, height: 210, maxWeightKg: 3000 },
  { id: "toco", name: "Toco (baú 7 m)", length: 700, width: 245, height: 260, maxWeightKg: 6000 },
  { id: "truck", name: "Truck (baú 8,5 m)", length: 850, width: 245, height: 270, maxWeightKg: 12000 },
  { id: "carreta", name: "Carreta (baú 14 m)", length: 1400, width: 248, height: 275, maxWeightKg: 27000 },
  { id: "c20", name: "Contêiner 20'", length: 590, width: 235, height: 239, maxWeightKg: 21700 },
  { id: "c40", name: "Contêiner 40'", length: 1203, width: 235, height: 239, maxWeightKg: 26500 },
];

export const KIND_LABEL: Record<CargoKind, string> = {
  caixa: "Caixa",
  palete: "Palete",
  tambor: "Tambor",
  eletro: "Eletrodoméstico",
  fragil: "Frágil",
  saco: "Sacaria",
};

export const DEMO_ITEMS: CargoItem[] = [
  { id: "P1", name: "Palete de bebidas", kind: "palete", description: "Refrigerante lata 350 ml, 120 fardos filmados", customer: "Mercado Bom Preço", stop: 1, length: 120, width: 100, height: 150, weightKg: 900, quantity: 4, stackable: false, color: "#3b82f6" },
  { id: "P2", name: "Geladeira duplex", kind: "eletro", description: "Refrigerador 480 L frost free, embalagem original", customer: "Casa & Lar Eletro", stop: 2, length: 75, width: 80, height: 185, weightKg: 85, quantity: 3, stackable: false, color: "#10b981" },
  { id: "P3", name: "Caixas de calçados", kind: "caixa", description: "Tênis esportivo, 12 pares por caixa", customer: "Loja Passo Certo", stop: 2, length: 60, width: 40, height: 40, weightKg: 14, quantity: 18, stackable: true, color: "#f59e0b" },
  { id: "P4", name: "Tambor de óleo", kind: "tambor", description: "Óleo lubrificante 200 L, lacrado", customer: "Auto Peças Rota", stop: 3, length: 60, width: 60, height: 90, weightKg: 190, quantity: 6, stackable: false, color: "#64748b" },
  { id: "P5", name: "Louças e vidros", kind: "fragil", description: "Jogos de pratos e taças — não empilhar, manusear com cuidado", customer: "Casa & Lar Eletro", stop: 2, length: 50, width: 50, height: 45, weightKg: 18, quantity: 6, stackable: false, color: "#ec4899" },
  { id: "P6", name: "Sacos de ração", kind: "saco", description: "Ração animal 25 kg, paletizada", customer: "Agro Campo Verde", stop: 4, length: 120, width: 100, height: 110, weightKg: 1000, quantity: 2, stackable: false, color: "#a16207" },
  { id: "P7", name: "Caixas de eletrônicos", kind: "caixa", description: "Monitores 27\" — 2 por caixa", customer: "TecInfo Distribuidora", stop: 1, length: 70, width: 50, height: 50, weightKg: 16, quantity: 10, stackable: true, color: "#8b5cf6" },
  { id: "P8", name: "Máquina de lavar", kind: "eletro", description: "Lavadora 12 kg, embalagem original", customer: "Casa & Lar Eletro", stop: 2, length: 65, width: 70, height: 105, weightKg: 45, quantity: 4, stackable: true, color: "#14b8a6" },
  { id: "P9", name: "Caixas de medicamentos", kind: "fragil", description: "Carga controlada, temperatura ambiente", customer: "Farma Vida", stop: 3, length: 40, width: 30, height: 30, weightKg: 6, quantity: 20, stackable: true, color: "#ef4444" },
];

const EPS = 0.001;
const overlap = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - EPS && b0 < a1 - EPS;

/**
 * Empacota os itens selecionados por pontos extremos.
 * Ordem: última parada primeiro (vai para a cabine), primeira parada por último (porta).
 * Dentro da mesma parada: não empilháveis e maiores primeiro.
 */
export function packCargo(items: CargoItem[], vehicle: Vehicle3D): PackResult {
  const sorted = [...items].sort(
    (a, b) => b.stop - a.stop || Number(a.stackable) - Number(b.stackable) || b.length * b.width * b.height - a.length * a.width * a.height
  );
  const placed: PlacedBox[] = [];
  const unplacedMap = new Map<string, { count: number; reason: string }>();
  let points: [number, number, number][] = [[0, 0, 0]];
  let weight = 0;
  const byId = new Map(items.map((i) => [i.id, i]));

  const fits = (x: number, y: number, z: number, dx: number, dy: number, dz: number) => {
    if (x + dx > vehicle.length + EPS || y + dy > vehicle.height + EPS || z + dz > vehicle.width + EPS) return false;
    for (const p of placed) {
      if (overlap(x, x + dx, p.x, p.x + p.dx) && overlap(y, y + dy, p.y, p.y + p.dy) && overlap(z, z + dz, p.z, p.z + p.dz)) return false;
    }
    if (y > EPS) {
      // Apoio: precisa estar sobre caixas empilháveis cobrindo ao menos 70% da base.
      let support = 0;
      for (const p of placed) {
        if (Math.abs(p.y + p.dy - y) > EPS) continue;
        const ox = Math.min(x + dx, p.x + p.dx) - Math.max(x, p.x);
        const oz = Math.min(z + dz, p.z + p.dz) - Math.max(z, p.z);
        if (ox <= EPS || oz <= EPS) continue;
        if (!byId.get(p.itemId)?.stackable) return false;
        support += ox * oz;
      }
      if (support < dx * dz * 0.7) return false;
    }
    return true;
  };

  for (const item of sorted) {
    // Rotação só no plano do piso (nunca deitar a carga).
    const orientations: [number, number, number][] = [
      [item.length, item.height, item.width],
      [item.width, item.height, item.length],
    ];
    for (let unit = 1; unit <= item.quantity; unit++) {
      if (weight + item.weightKg > vehicle.maxWeightKg) {
        const u = unplacedMap.get(item.id) ?? { count: 0, reason: "Excede o peso máximo do veículo" };
        u.count++;
        unplacedMap.set(item.id, u);
        continue;
      }
      // Preferir mais perto da cabine, depois mais baixo, depois à esquerda.
      points.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
      let done = false;
      for (const [x, y, z] of points) {
        for (const [dx, dy, dz] of orientations) {
          if (!fits(x, y, z, dx, dy, dz)) continue;
          placed.push({ key: `${item.id}-${unit}`, itemId: item.id, unit, x, y, z, dx, dy, dz });
          weight += item.weightKg;
          points = points.filter((p) => !(p[0] === x && p[1] === y && p[2] === z));
          points.push([x + dx, y, z], [x, y + dy, z], [x, y, z + dz]);
          done = true;
          break;
        }
        if (done) break;
      }
      if (!done) {
        const u = unplacedMap.get(item.id) ?? { count: 0, reason: "Sem espaço disponível no baú" };
        u.count++;
        unplacedMap.set(item.id, u);
      }
    }
  }

  const volumeTotal = (vehicle.length * vehicle.width * vehicle.height) / 1e6;
  const volumeUsed = placed.reduce((s, p) => s + p.dx * p.dy * p.dz, 0) / 1e6;
  return {
    placed,
    unplaced: [...unplacedMap.entries()].map(([itemId, v]) => ({ itemId, ...v })),
    volumeUsedM3: Math.round(volumeUsed * 100) / 100,
    volumeTotalM3: Math.round(volumeTotal * 100) / 100,
    weightKg: weight,
    occupancyPercent: Math.round((volumeUsed / volumeTotal) * 1000) / 10,
    weightPercent: Math.round((weight / vehicle.maxWeightKg) * 1000) / 10,
  };
}

// ---------------------------------------------------------------- Pátio (ruas)
// Antes do carregamento, cada parada ganha uma rua no pátio da doca:
// rua A = 1ª entrega, rua B = 2ª… A empilhadeira busca rua por rua,
// começando pela última entrega (que vai para o fundo do baú).

export interface Lane {
  letter: string;
  stop: number;
  customers: string[];
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface StagingLayout {
  /** Posição no pátio (canto mínimo, y = base) de cada volume carregado, pela key do PlacedBox. */
  slots: Map<string, { x: number; y: number; z: number }>;
  lanes: Lane[];
}

export const laneLetter = (index: number) => String.fromCharCode(65 + (index % 26));

export function stagingLayout(placed: PlacedBox[], items: CargoItem[], originX: number, centerZ: number, rowLength = 720): StagingLayout {
  const byId = new Map(items.map((i) => [i.id, i]));
  const stops = [...new Set(placed.map((p) => byId.get(p.itemId)!.stop))].sort((a, b) => a - b);
  const slots = new Map<string, { x: number; y: number; z: number }>();
  const lanes: Lane[] = [];
  const GAP = 25;
  let laneZ = 0;

  stops.forEach((stop, idx) => {
    const boxes = placed.filter((p) => byId.get(p.itemId)!.stop === stop);
    let cx = originX + GAP;
    let cz = laneZ + GAP;
    let rowDepth = 0;
    let last: { key: string; itemId: string; x: number; y: number; z: number; dx: number; dy: number; dz: number; level: number } | null = null;
    let maxX = cx;
    for (const b of boxes) {
      const item = byId.get(b.itemId)!;
      const maxLevels = item.stackable ? Math.max(1, Math.floor(160 / b.dy)) : 1;
      if (last && last.itemId === b.itemId && last.dx === b.dx && last.dz === b.dz && last.level < maxLevels) {
        const s: { x: number; y: number; z: number } = { x: last.x, y: last.y + last.dy, z: last.z };
        slots.set(b.key, s);
        last = { key: b.key, itemId: last.itemId, x: s.x, y: s.y, z: s.z, dx: last.dx, dy: b.dy, dz: last.dz, level: last.level + 1 };
        continue;
      }
      if (cx + b.dx > originX + rowLength && cx > originX + GAP) {
        cz += rowDepth + GAP;
        cx = originX + GAP;
        rowDepth = 0;
      }
      const s = { x: cx, y: 0, z: cz };
      slots.set(b.key, s);
      last = { key: b.key, itemId: b.itemId, ...s, dx: b.dx, dy: b.dy, dz: b.dz, level: 1 };
      cx += b.dx + GAP;
      maxX = Math.max(maxX, cx);
      rowDepth = Math.max(rowDepth, b.dz);
    }
    const z1 = cz + rowDepth + GAP;
    lanes.push({
      letter: laneLetter(idx),
      stop,
      customers: [...new Set(boxes.map((b) => byId.get(b.itemId)!.customer))],
      x0: originX,
      x1: Math.max(maxX, originX + 300),
      z0: laneZ,
      z1,
    });
    laneZ = z1 + 90; // corredor entre ruas
  });

  // Centraliza as ruas em relação ao baú.
  const total = lanes.length ? lanes[lanes.length - 1].z1 : 0;
  const shift = centerZ - total / 2;
  for (const l of lanes) {
    l.z0 += shift;
    l.z1 += shift;
  }
  for (const s of slots.values()) s.z += shift;
  return { slots, lanes };
}
