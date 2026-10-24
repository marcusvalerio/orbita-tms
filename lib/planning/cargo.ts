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
  /** Eixos: posição em cm a partir da parede da cabine (negativo = à frente do baú). */
  axles: AxleConfig;
}

export interface AxleConfig {
  frontLabel: string;
  rearLabel: string;
  frontX: number;
  rearX: number;
  /** Peso do veículo vazio sobre cada eixo (kg). */
  tareFrontKg: number;
  tareRearKg: number;
  /** Limite por eixo (kg). */
  limitFrontKg: number;
  limitRearKg: number;
}

/** Volume de carga já unitizado (um palete montado), posicionado no baú. */
export interface PlacedBox {
  /** Identificador do palete (ex.: "P3-2" = 2º palete do item P3). */
  key: string;
  itemId: string;
  /** Número do palete dentro do item (1, 2…). */
  unit: number;
  /** Quantidade de volumes do item neste palete. */
  count: number;
  weightKg: number;
  /** Pode receber outro palete por cima. */
  stackable: boolean;
  /** Arranjo das peças sobre o palete (relativo ao centro da base, y = topo do estrado). */
  cases: { x: number; y: number; z: number; dx: number; dy: number; dz: number }[];
  x: number;
  y: number;
  z: number;
  /** Dimensões no baú: dx (comprimento), dy (altura), dz (largura). */
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

// Limites de referência por eixo (Brasil): dianteiro simples 6 t, traseiro simples
// rodado duplo 10 t, tandem duplo 17 t, tandem triplo 25,5 t. Valores do VUC
// seguem a capacidade técnica típica. Taras e entre-eixos são aproximados.
const eixoCaminhao = (frontX: number, rearX: number, tareF: number, tareR: number, limF: number, limR: number, rearLabel = "Traseiro"): AxleConfig => ({
  frontLabel: "Dianteiro",
  rearLabel,
  frontX,
  rearX,
  tareFrontKg: tareF,
  tareRearKg: tareR,
  limitFrontKg: limF,
  limitRearKg: limR,
});
const eixoCarreta = (length: number, tareF: number, tareR: number): AxleConfig => ({
  frontLabel: "Cavalo (5ª roda)",
  rearLabel: "Tandem traseiro",
  frontX: 90,
  rearX: length - 250,
  tareFrontKg: tareF,
  tareRearKg: tareR,
  limitFrontKg: 17000,
  limitRearKg: 25500,
});

export const VEHICLES: Vehicle3D[] = [
  { id: "vuc", name: "VUC (baú 4,2 m)", length: 420, width: 210, height: 210, maxWeightKg: 3000, axles: eixoCaminhao(-110, 290, 1700, 1300, 2800, 4400) },
  { id: "toco", name: "Toco (baú 7 m)", length: 700, width: 245, height: 260, maxWeightKg: 6000, axles: eixoCaminhao(-130, 500, 3000, 2600, 6000, 10000) },
  { id: "truck", name: "Truck (baú 8,5 m)", length: 850, width: 245, height: 270, maxWeightKg: 12000, axles: eixoCaminhao(-130, 600, 3300, 4400, 6000, 17000, "Tandem traseiro") },
  { id: "carreta", name: "Carreta (baú 14 m)", length: 1400, width: 248, height: 275, maxWeightKg: 27000, axles: eixoCarreta(1400, 3000, 5500) },
  { id: "c20", name: "Contêiner 20'", length: 590, width: 235, height: 239, maxWeightKg: 21700, axles: eixoCarreta(590, 2600, 3200) },
  { id: "c40", name: "Contêiner 40'", length: 1203, width: 235, height: 239, maxWeightKg: 26500, axles: eixoCarreta(1203, 3000, 4800) },
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
  { id: "P1", name: "Palete de bebidas", kind: "palete", description: "Refrigerante lata 350 ml, 120 fardos filmados", customer: "Mercado Bom Preço", stop: 1, length: 120, width: 100, height: 150, weightKg: 900, quantity: 2, stackable: false, color: "#3b82f6" },
  { id: "P2", name: "Geladeira duplex", kind: "eletro", description: "Refrigerador 480 L frost free, embalagem original", customer: "Casa & Lar Eletro", stop: 2, length: 75, width: 80, height: 185, weightKg: 85, quantity: 2, stackable: false, color: "#10b981" },
  { id: "P3", name: "Caixas de calçados", kind: "caixa", description: "Tênis esportivo, 12 pares por caixa", customer: "Loja Passo Certo", stop: 2, length: 60, width: 40, height: 40, weightKg: 14, quantity: 16, stackable: true, color: "#f59e0b" },
  { id: "P4", name: "Tambor de óleo", kind: "tambor", description: "Óleo lubrificante 200 L, lacrado", customer: "Auto Peças Rota", stop: 3, length: 60, width: 60, height: 90, weightKg: 190, quantity: 4, stackable: false, color: "#64748b" },
  { id: "P5", name: "Louças e vidros", kind: "fragil", description: "Jogos de pratos e taças — não empilhar, manusear com cuidado", customer: "Casa & Lar Eletro", stop: 2, length: 50, width: 50, height: 45, weightKg: 18, quantity: 4, stackable: false, color: "#ec4899" },
  { id: "P6", name: "Sacos de ração", kind: "saco", description: "Ração animal 25 kg, paletizada", customer: "Agro Campo Verde", stop: 4, length: 120, width: 100, height: 110, weightKg: 1000, quantity: 2, stackable: false, color: "#a16207" },
  { id: "P7", name: "Caixas de eletrônicos", kind: "caixa", description: "Monitores 27\" — 2 por caixa", customer: "TecInfo Distribuidora", stop: 1, length: 70, width: 50, height: 50, weightKg: 16, quantity: 6, stackable: true, color: "#8b5cf6" },
  { id: "P8", name: "Máquina de lavar", kind: "eletro", description: "Lavadora 12 kg, embalagem original", customer: "Casa & Lar Eletro", stop: 2, length: 65, width: 70, height: 105, weightKg: 45, quantity: 4, stackable: true, color: "#14b8a6" },
  { id: "P9", name: "Caixas de medicamentos", kind: "fragil", description: "Carga controlada, temperatura ambiente", customer: "Farma Vida", stop: 3, length: 40, width: 30, height: 30, weightKg: 6, quantity: 18, stackable: true, color: "#ef4444" },
];

const EPS = 0.001;
const overlap = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - EPS && b0 < a1 - EPS;

// ---------------------------------------------------------------- Paletização
// Tudo vai sobre palete PBR (120 × 100 cm, estrado de 15 cm): caixas em camadas,
// tambores de 4 em 4, eletrodomésticos e frágeis em uma só camada. Itens que já
// são palete (bebidas, sacaria) entram como estão.

export const PALLET = { length: 120, width: 100, deck: 15, tareKg: 25, maxHeight: 175 };

export type PalletUnit = Omit<PlacedBox, "x" | "y" | "z">;

export function palletize(items: CargoItem[]): PalletUnit[] {
  const units: PalletUnit[] = [];
  for (const item of items) {
    if (item.kind === "palete" || item.kind === "saco") {
      for (let u = 1; u <= item.quantity; u++)
        units.push({
          key: `${item.id}-${u}`,
          itemId: item.id,
          unit: u,
          count: 1,
          weightKg: item.weightKg,
          stackable: item.stackable,
          cases: [],
          dx: item.length,
          dy: item.height,
          dz: item.width,
        });
      continue;
    }
    // melhor orientação da peça na camada
    const fit = (l: number, w: number) => Math.floor(PALLET.length / l) * Math.floor(PALLET.width / w);
    const turned = fit(item.width, item.length) > fit(item.length, item.width);
    const cl = turned ? item.width : item.length;
    const cw = turned ? item.length : item.width;
    const nx = Math.max(1, Math.floor(PALLET.length / cl));
    const nz = Math.max(1, Math.floor(PALLET.width / cw));
    const singleLayer = !item.stackable;
    const layers = singleLayer ? 1 : Math.max(1, Math.floor((PALLET.maxHeight - PALLET.deck) / item.height));
    const perPallet = nx * nz * layers;
    let left = item.quantity;
    let u = 0;
    while (left > 0) {
      u++;
      const count = Math.min(perPallet, left);
      left -= count;
      const cases: PalletUnit["cases"] = [];
      // espalha as peças pela base (centralizado) e sobe camada por camada
      const gx = (PALLET.length - nx * cl) / 2;
      const gz = (PALLET.width - nz * cw) / 2;
      for (let k = 0; k < count; k++) {
        const layer = Math.floor(k / (nx * nz));
        const i = k % (nx * nz);
        const ix = i % nx;
        const iz = Math.floor(i / nx);
        cases.push({ x: -PALLET.length / 2 + gx + cl * (ix + 0.5), y: layer * item.height, z: -PALLET.width / 2 + gz + cw * (iz + 0.5), dx: cl, dy: item.height, dz: cw });
      }
      const usedLayers = Math.ceil(count / (nx * nz));
      units.push({
        key: `${item.id}-${u}`,
        itemId: item.id,
        unit: u,
        count,
        weightKg: count * item.weightKg + PALLET.tareKg,
        // palete só recebe outro por cima se as peças aguentam e ele está completo e plano
        stackable: item.stackable && !singleLayer && count % (nx * nz) === 0,
        cases,
        dx: PALLET.length,
        dy: PALLET.deck + usedLayers * item.height,
        dz: PALLET.width,
      });
    }
  }
  return units;
}

/**
 * Paletiza e arruma os paletes por pontos extremos.
 * Ordem: última parada primeiro (vai para a cabine), primeira parada por último (porta).
 */
export function packCargo(items: CargoItem[], vehicle: Vehicle3D): PackResult {
  const byId = new Map(items.map((i) => [i.id, i]));
  const units = palletize(items).sort((a, b) => {
    const sa = byId.get(a.itemId)!.stop;
    const sb = byId.get(b.itemId)!.stop;
    return sb - sa || Number(b.stackable) - Number(a.stackable) || b.weightKg - a.weightKg;
  });
  const placed: PlacedBox[] = [];
  const unplacedMap = new Map<string, { count: number; reason: string }>();
  let points: [number, number, number][] = [[0, 0, 0]];
  let weight = 0;

  const fits = (x: number, y: number, z: number, dx: number, dy: number, dz: number, kg: number) => {
    if (x + dx > vehicle.length + EPS || y + dy > vehicle.height + EPS || z + dz > vehicle.width + EPS) return false;
    for (const p of placed) {
      if (overlap(x, x + dx, p.x, p.x + p.dx) && overlap(y, y + dy, p.y, p.y + p.dy) && overlap(z, z + dz, p.z, p.z + p.dz)) return false;
    }
    if (y > EPS) {
      // em cima de outro palete: precisa de apoio total num palete empilhável de mesma base
      const base = placed.find((p) => Math.abs(p.y + p.dy - y) < EPS && Math.abs(p.x - x) < EPS && Math.abs(p.z - z) < EPS && p.dx === dx && p.dz === dz);
      // e nunca um palete mais pesado sobre um mais leve
      if (!base || !base.stackable || base.y > EPS || kg > base.weightKg) return false;
    }
    return true;
  };
  const skip = (u: PalletUnit, reason: string) => {
    const e = unplacedMap.get(u.itemId) ?? { count: 0, reason };
    e.count += u.count;
    unplacedMap.set(u.itemId, e);
  };

  for (const u of units) {
    if (weight + u.weightKg > vehicle.maxWeightKg) {
      skip(u, "Excede o peso máximo do veículo");
      continue;
    }
    // palete pode entrar de frente ou atravessado; atravessado primeiro quando
    // cabem dois lado a lado (ex.: baú de 2,45 m leva 2 PBR transversais)
    const crosswise = vehicle.width >= 2 * u.dx;
    const orient: [number, number][] = crosswise
      ? [
          [u.dz, u.dx],
          [u.dx, u.dz],
        ]
      : [
          [u.dx, u.dz],
          [u.dz, u.dx],
        ];
    points.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    let done = false;
    for (const [x, y, z] of points) {
      for (const [dx, dz] of orient) {
        if (!fits(x, y, z, dx, u.dy, dz, u.weightKg)) continue;
        const turned = dx !== u.dx;
        placed.push({
          ...u,
          // peças giram junto com o palete atravessado
          cases: turned ? u.cases.map((c) => ({ ...c, x: c.z, z: -c.x, dx: c.dz, dz: c.dx })) : u.cases,
          x,
          y,
          z,
          dx,
          dz,
        });
        weight += u.weightKg;
        points = points.filter((p) => !(p[0] === x && p[1] === y && p[2] === z));
        points.push([x + dx, y, z], [x, y + u.dy, z], [x, y, z + dz]);
        done = true;
        break;
      }
      if (done) break;
    }
    if (!done) skip(u, "Sem espaço disponível no baú");
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
// rua A = 1ª entrega, rua B = 2ª… Cada rua é uma fileira de paletes com um
// corredor à frente (lado +z) por onde a empilhadeira entra de frente.
// No pátio o palete fica girado 90° (garfo entra pelo lado +z).

export const AISLE = 380;

export interface Lane {
  letter: string;
  stop: number;
  customers: string[];
  x0: number;
  x1: number;
  /** Faixa da fileira de paletes. */
  z0: number;
  z1: number;
  /** Centro do corredor de acesso (lado +z da fileira). */
  aisleZ: number;
}

export interface StagingLayout {
  /** Centro de cada palete no pátio, pela key do PlacedBox. */
  slots: Map<string, { x: number; z: number }>;
  lanes: Lane[];
}

export const laneLetter = (index: number) => String.fromCharCode(65 + (index % 26));

export function stagingLayout(placed: PlacedBox[], items: CargoItem[], originX: number, centerZ: number): StagingLayout {
  const byId = new Map(items.map((i) => [i.id, i]));
  const stops = [...new Set(placed.map((p) => byId.get(p.itemId)!.stop))].sort((a, b) => a - b);
  const slots = new Map<string, { x: number; z: number }>();
  const lanes: Lane[] = [];
  const GAP = 35;
  let z = 0;
  stops.forEach((stop, idx) => {
    // no pátio só ficam paletes de base (os de cima são pegos como volumes próprios)
    const boxes = placed.filter((p) => byId.get(p.itemId)!.stop === stop);
    // girado 90°: extensão em x = dz, em z = dx (comprimento ao longo do garfo)
    const depth = Math.max(...boxes.map((b) => b.dx));
    let x = originX + GAP;
    for (const b of boxes) {
      slots.set(b.key, { x: x + b.dz / 2, z: z + depth - b.dx / 2 });
      x += b.dz + GAP;
    }
    lanes.push({
      letter: laneLetter(idx),
      stop,
      customers: [...new Set(boxes.map((b) => byId.get(b.itemId)!.customer))],
      x0: originX,
      x1: Math.max(x, originX + 300),
      z0: z,
      z1: z + depth,
      aisleZ: z + depth + AISLE / 2,
    });
    z += depth + AISLE;
  });
  // centraliza em relação ao baú
  const shift = centerZ - z / 2;
  for (const l of lanes) {
    l.z0 += shift;
    l.z1 += shift;
    l.aisleZ += shift;
  }
  for (const s of slots.values()) s.z += shift;
  return { slots, lanes };
}

// ---------------------------------------------------------------- Peso por eixo

export interface AxleLoad {
  /** Etapa: 0 = saída; n = depois da n-ésima entrega. */
  afterStop: number;
  cargoKg: number;
  /** Centro de gravidade da carga, cm a partir da parede da cabine (null sem carga). */
  cgX: number | null;
  frontKg: number;
  rearKg: number;
  frontPercent: number;
  rearPercent: number;
  legal: boolean;
}

/** Distribui o peso entre os eixos pela regra da alavanca, na saída e após cada entrega. */
export function axleLoads(placed: PlacedBox[], items: CargoItem[], vehicle: Vehicle3D): AxleLoad[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const stops = [...new Set(placed.map((p) => byId.get(p.itemId)!.stop))].sort((a, b) => a - b);
  const a = vehicle.axles;
  const span = a.rearX - a.frontX;
  const stages = [0, ...stops.slice(0, -1)];
  return stages.map((afterStop) => {
    const onBoard = placed.filter((p) => byId.get(p.itemId)!.stop > afterStop);
    let kg = 0;
    let moment = 0;
    for (const p of onBoard) {
      const w = p.weightKg;
      kg += w;
      moment += w * (p.x + p.dx / 2);
    }
    const cgX = kg ? moment / kg : null;
    const rearCargo = cgX === null ? 0 : (kg * (cgX - a.frontX)) / span;
    const frontKg = Math.round(a.tareFrontKg + kg - rearCargo);
    const rearKg = Math.round(a.tareRearKg + rearCargo);
    return {
      afterStop,
      cargoKg: kg,
      cgX: cgX === null ? null : Math.round(cgX),
      frontKg,
      rearKg,
      frontPercent: Math.round((frontKg / a.limitFrontKg) * 100),
      rearPercent: Math.round((rearKg / a.limitRearKg) * 100),
      legal: frontKg <= a.limitFrontKg && rearKg <= a.limitRearKg,
    };
  });
}

/** Faixa do centro de gravidade em que os dois eixos ficam dentro do limite (cm). */
export function cgWindow(cargoKg: number, vehicle: Vehicle3D): { min: number; max: number } | null {
  if (!cargoKg) return null;
  const a = vehicle.axles;
  const span = a.rearX - a.frontX;
  // rear = tareR + kg*(cg-f)/span ≤ limR  →  cg ≤ f + (limR - tareR)*span/kg
  // front = tareF + kg - kg*(cg-f)/span ≤ limF  →  cg ≥ f + (tareF + kg - limF)*span/kg
  const max = a.frontX + ((a.limitRearKg - a.tareRearKg) * span) / cargoKg;
  const min = a.frontX + ((a.tareFrontKg + cargoKg - a.limitFrontKg) * span) / cargoKg;
  const lo = Math.max(0, min);
  const hi = Math.min(vehicle.length, max);
  return lo <= hi ? { min: Math.round(lo), max: Math.round(hi) } : null;
}
