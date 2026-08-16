import type { Carrier, Vehicle } from "../domain/types";

export interface FreightBreakdown {
  freightWeight: number;
  adValorem: number;
  gris: number;
  toll: number;
  deliveryFee: number;
  total: number;
}

export interface TransportOptionQuote {
  id: string;
  label: string;
  isOwnFleet: boolean;
  breakdown: FreightBreakdown;
  price: number; // = breakdown.total, mantido para compatibilidade
  etaDays: number;
  slaPercent: number;
  otifPercent: number;
}

function buildBreakdown(totalWeightKg: number, costPerKgFactor: number): FreightBreakdown {
  const freightWeight = Math.round(totalWeightKg * costPerKgFactor);
  // Valor da mercadoria não é capturado no pedido nesta versão — usamos uma
  // estimativa proporcional ao peso apenas para compor Ad Valorem/GRIS de forma
  // didática. Isso é sinalizado à pessoa usuária como frete simulado.
  const estimatedMerchandiseValue = totalWeightKg * 35;
  const adValorem = Math.round(estimatedMerchandiseValue * 0.003 * 100) / 100;
  const gris = Math.round(estimatedMerchandiseValue * 0.001 * 100) / 100;
  const toll = totalWeightKg > 1000 ? 85 : 45;
  const deliveryFee = 60;
  const total = Math.round((freightWeight + adValorem + gris + toll + deliveryFee) * 100) / 100;
  return { freightWeight, adValorem, gris, toll, deliveryFee, total };
}

/**
 * Cotação determinística de frete por opção de transporte, dado o peso total
 * da carga composta. Os valores são simulados para fins didáticos — não
 * representam uma tabela real de nenhuma transportadora.
 */
export function quoteTransportOptions(
  totalWeightKg: number,
  carriers: Carrier[]
): TransportOptionQuote[] {
  if (totalWeightKg <= 0) return [];

  const ownFleetBreakdown = buildBreakdown(totalWeightKg, 0.65);
  const ownFleet: TransportOptionQuote = {
    id: "own-fleet",
    label: "Frota Própria",
    isOwnFleet: true,
    breakdown: ownFleetBreakdown,
    price: ownFleetBreakdown.total,
    etaDays: 1,
    slaPercent: 100,
    otifPercent: 100,
  };

  const carrierOptions = carriers.slice(0, 3).map((carrier) => {
    const breakdown = buildBreakdown(totalWeightKg, carrier.avgCostPerKm * 0.045);
    return {
      id: carrier.id,
      label: carrier.name,
      isOwnFleet: false,
      breakdown,
      price: breakdown.total,
      etaDays: carrier.avgCostPerKm > 2.2 ? 1 : 2,
      slaPercent: carrier.slaPercent,
      otifPercent: carrier.otifPercent,
    };
  });

  return [ownFleet, ...carrierOptions].sort((a, b) => a.price - b.price);
}

export function findVehicleForWeight(vehicles: Vehicle[], totalWeightKg: number): Vehicle | undefined {
  return vehicles
    .filter((v) => v.status === "Disponível")
    .sort((a, b) => a.capacityKg - b.capacityKg)
    .find((v) => v.capacityKg >= totalWeightKg);
}
