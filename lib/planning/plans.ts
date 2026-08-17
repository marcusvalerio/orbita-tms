import type { Order, Carrier, Vehicle } from "../domain/types";
import { quoteTransportOptions, findVehicleForWeight, type TransportOptionQuote } from "./quote";

export interface ScoreBreakdown {
  costScore: number;
  prazoScore: number;
  slaScore: number;
  occupancyScore: number;
  otifScore: number;
}

export interface PlanOption {
  key: "A" | "B" | "C";
  name: string;
  strategy: string;
  orderIds: string[];
  totalWeightKg: number;
  totalVolumeM3: number;
  vehicle: Vehicle;
  occupancyPercent: number;
  transportOption: TransportOptionQuote;
  score: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface PlanningAnalysis {
  compatible: boolean;
  totalWeightKg: number;
  totalVolumeM3: number;
  vehicle?: Vehicle;
  plans: PlanOption[];
  recommendedKey: PlanOption["key"];
}

// Pesos do índice de adequação — parâmetros simulados, apresentados
// explicitamente à pessoa usuária (não representam nenhum benchmark real).
const WEIGHTS = { custo: 0.3, prazo: 0.2, sla: 0.2, ocupacao: 0.15, otif: 0.15 };

function scoreOptions(options: TransportOptionQuote[], occupancyPercent: number): ScoreBreakdown[] {
  const prices = options.map((o) => o.price);
  const days = options.map((o) => o.etaDays);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minDays = Math.min(...days);
  const maxDays = Math.max(...days);

  return options.map((o) => ({
    costScore: Math.round(100 - ((o.price - minPrice) / (maxPrice - minPrice || 1)) * 100),
    prazoScore: Math.round(100 - ((o.etaDays - minDays) / (maxDays - minDays || 1)) * 100),
    slaScore: Math.round(o.slaPercent),
    occupancyScore: Math.round(Math.min(100, occupancyPercent)),
    otifScore: Math.round(o.otifPercent),
  }));
}

function weightedTotal(b: ScoreBreakdown): number {
  return Math.round(
    b.costScore * WEIGHTS.custo +
      b.prazoScore * WEIGHTS.prazo +
      b.slaScore * WEIGHTS.sla +
      b.occupancyScore * WEIGHTS.ocupacao +
      b.otifScore * WEIGHTS.otif
  );
}

/**
 * Gera 3 alternativas de planejamento simuladas para o mesmo conjunto de
 * pedidos: consolidação máxima (frota própria quando couber), menor custo
 * (frete mais barato do mercado simulado) e maior nível de serviço (melhor
 * OTIF/SLA disponível). Nesta versão as três alternativas usam um único
 * veículo/viagem — elas variam pela transportadora escolhida, não pelo
 * fracionamento em múltiplas viagens.
 */
export function analyzePlanning(orders: Order[], carriers: Carrier[], vehicles: Vehicle[]): PlanningAnalysis {
  const totalWeightKg = orders.reduce((sum, o) => sum + o.totalWeightKg, 0);
  const totalVolumeM3 = Math.round(orders.reduce((sum, o) => sum + o.totalVolumeM3, 0) * 10) / 10;
  const vehicle = findVehicleForWeight(vehicles, totalWeightKg);

  if (!vehicle || totalWeightKg <= 0) {
    return { compatible: false, totalWeightKg, totalVolumeM3, vehicle: undefined, plans: [], recommendedKey: "A" };
  }

  const occupancyPercent = Math.round((totalWeightKg / vehicle.capacityKg) * 100);
  const options = quoteTransportOptions(totalWeightKg, carriers); // já ordenado por preço crescente

  const cheapest = options[0];
  const ownFleet = options.find((o) => o.isOwnFleet) ?? cheapest;
  const bestService = [...options].sort(
    (a, b) => b.otifPercent - a.otifPercent || b.slaPercent - a.slaPercent
  )[0];

  const optionA = ownFleet;
  const optionB = cheapest.id === optionA.id ? options[1] ?? cheapest : cheapest;
  const optionC = bestService.id === optionA.id || bestService.id === optionB.id
    ? options.find((o) => o.id !== optionA.id && o.id !== optionB.id) ?? bestService
    : bestService;

  const chosenOptions = [optionA, optionB, optionC];
  const scores = scoreOptions(chosenOptions, occupancyPercent);

  const plans: PlanOption[] = [
    {
      key: "A",
      name: "Consolidação Máxima",
      strategy: "Todos os pedidos em uma única viagem, priorizando frota própria quando há capacidade disponível.",
      orderIds: orders.map((o) => o.id),
      totalWeightKg,
      totalVolumeM3,
      vehicle,
      occupancyPercent,
      transportOption: optionA,
      score: weightedTotal(scores[0]),
      scoreBreakdown: scores[0],
    },
    {
      key: "B",
      name: "Menor Custo",
      strategy: "Mesma consolidação, priorizando o frete mais barato disponível entre frota própria e transportadoras.",
      orderIds: orders.map((o) => o.id),
      totalWeightKg,
      totalVolumeM3,
      vehicle,
      occupancyPercent,
      transportOption: optionB,
      score: weightedTotal(scores[1]),
      scoreBreakdown: scores[1],
    },
    {
      key: "C",
      name: "Maior Nível de Serviço",
      strategy: "Mesma consolidação, priorizando a transportadora com melhor SLA e OTIF histórico simulados.",
      orderIds: orders.map((o) => o.id),
      totalWeightKg,
      totalVolumeM3,
      vehicle,
      occupancyPercent,
      transportOption: optionC,
      score: weightedTotal(scores[2]),
      scoreBreakdown: scores[2],
    },
  ];

  const recommendedKey = [...plans].sort((a, b) => b.score - a.score)[0].key;

  return { compatible: true, totalWeightKg, totalVolumeM3, vehicle, plans, recommendedKey };
}

export function explainPlan(plan: PlanOption, allPlans: PlanOption[]): string[] {
  const reasons: string[] = [];
  const others = allPlans.filter((p) => p.key !== plan.key);
  const maxPrice = Math.max(...allPlans.map((p) => p.transportOption.price));

  if (plan.transportOption.price === Math.min(...allPlans.map((p) => p.transportOption.price))) {
    reasons.push(`possui o menor frete entre as alternativas (R$ ${plan.transportOption.price.toLocaleString("pt-BR")})`);
  } else if (maxPrice > plan.transportOption.price) {
    const diffPercent = Math.round(((maxPrice - plan.transportOption.price) / maxPrice) * 100);
    reasons.push(`custo ${diffPercent}% menor que a alternativa mais cara`);
  }

  reasons.push(`utiliza ${plan.occupancyPercent}% da capacidade do veículo (${plan.vehicle.id})`);
  reasons.push(`SLA de ${plan.transportOption.slaPercent}% e OTIF histórico simulado de ${plan.transportOption.otifPercent}%`);

  const betterOtif = others.every((o) => o.transportOption.otifPercent <= plan.transportOption.otifPercent);
  if (betterOtif && others.length > 0) {
    reasons.push("melhor nível de serviço (OTIF) entre as alternativas comparadas");
  }

  reasons.push(`prazo estimado de D+${plan.transportOption.etaDays}`);

  return reasons;
}
