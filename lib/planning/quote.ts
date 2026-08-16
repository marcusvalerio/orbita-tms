import type { Carrier, Vehicle } from "../domain/types";

export interface TransportOptionQuote {
  id: string;
  label: string;
  isOwnFleet: boolean;
  price: number;
  etaDays: number;
  slaPercent: number;
}

/**
 * Cotação determinística de frete por opção de transporte, dado o peso total
 * da carga composta. Usa a mesma lógica conceitual da simulação inicial
 * (seção 17/24 do prompt), mas calculada sob demanda para permitir
 * composições de carga arbitrárias no workspace de Planning.
 */
export function quoteTransportOptions(
  totalWeightKg: number,
  carriers: Carrier[]
): TransportOptionQuote[] {
  if (totalWeightKg <= 0) return [];

  const ownFleet: TransportOptionQuote = {
    id: "own-fleet",
    label: "Frota Própria",
    isOwnFleet: true,
    price: Math.round(totalWeightKg * 0.8),
    etaDays: 1,
    slaPercent: 100,
  };

  const carrierOptions = carriers.slice(0, 3).map((carrier) => ({
    id: carrier.id,
    label: carrier.name,
    isOwnFleet: false,
    price: Math.round(totalWeightKg * carrier.avgCostPerKm * 0.05),
    etaDays: carrier.avgCostPerKm > 2.2 ? 1 : 2,
    slaPercent: carrier.slaPercent,
  }));

  return [ownFleet, ...carrierOptions].sort((a, b) => a.price - b.price);
}

export function findVehicleForWeight(vehicles: Vehicle[], totalWeightKg: number): Vehicle | undefined {
  return vehicles
    .filter((v) => v.status === "Disponível")
    .sort((a, b) => a.capacityKg - b.capacityKg)
    .find((v) => v.capacityKg >= totalWeightKg);
}
