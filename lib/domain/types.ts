// ÓRBITA TMS — Modelo de domínio
// Tipos e relações centrais da operação logística simulada.
// Nenhum dado real. Nenhuma persistência real. Apenas contratos de domínio.

export type ID = string;

// ---------------------------------------------------------------------------
// Entidades de referência
// ---------------------------------------------------------------------------

export interface Company {
  id: ID;
  name: string;
  region: string;
  operationType: "Rodoviária";
}

export interface Location {
  id: ID;
  name: string;
  city: string;
  state: string;
  kind: "CD" | "Cliente" | "Parceiro";
  lat: number;
  lng: number;
}

export interface Customer {
  id: ID;
  name: string;
  locationId: ID;
}

export interface Product {
  id: ID;
  name: string;
  category: string;
}

export interface Vehicle {
  id: ID; // e.g. TRK-042
  plate: string;
  type: "Van" | "Toco" | "Truck" | "Carreta";
  capacityKg: number;
  capacityM3: number;
  ownership: "Frota Própria" | "Terceiro";
  status: "Disponível" | "Em Viagem" | "Manutenção";
}

export interface Driver {
  id: ID;
  name: string;
  cnhCategory: string;
  status: "Disponível" | "Em Viagem" | "Folga";
}

export interface Carrier {
  id: ID;
  name: string;
  regions: string[];
  cargoTypes: string[];
  slaPercent: number; // 0-100
  otifPercent: number; // 0-100
  avgCostPerKm: number;
  occurrenceRate: number; // 0-1
}

// ---------------------------------------------------------------------------
// Ciclo operacional: Pedido → Carga → Viagem → Entrega
// ---------------------------------------------------------------------------

export type OrderStatus =
  | "Aguardando planejamento"
  | "Planejado"
  | "Em transporte"
  | "Entregue"
  | "Com ocorrência";

export interface OrderItem {
  id: ID;
  productId: ID;
  quantity: number;
  weightKg: number;
}

export interface Order {
  id: ID; // PED-10482
  originId: ID;
  destinationId: ID;
  customerId: ID;
  items: OrderItem[];
  totalWeightKg: number;
  totalVolumeM3: number;
  dueDate: string; // ISO date
  priority: "Normal" | "Alta" | "Urgente";
  status: OrderStatus;
  loadId?: ID;
}

export type LoadStatus =
  | "Em consolidação"
  | "Aguardando transporte"
  | "Contratada"
  | "Em viagem"
  | "Concluída";

export interface Load {
  id: ID; // LOAD-00381
  orderIds: ID[];
  originId: ID;
  destinationId: ID;
  totalWeightKg: number;
  totalVolumeM3: number;
  status: LoadStatus;
  shipmentId?: ID;
}

export interface TenderOption {
  id: ID;
  loadId: ID;
  carrierId: ID;
  isOwnFleet: boolean;
  price: number;
  etaDays: number;
  slaPercent: number;
  occupancyPercent: number;
}

export interface Tender {
  id: ID;
  loadId: ID;
  options: TenderOption[];
  selectedOptionId?: ID;
}

export type ShipmentStatus =
  | "Planned"
  | "Awaiting Pickup"
  | "Pickup Completed"
  | "In Transit"
  | "At Delivery"
  | "Delivered"
  | "Closed"
  | "Exception";

export interface Stop {
  id: ID;
  locationId: ID;
  sequence: number;
  kind: "Coleta" | "Entrega";
  plannedTime: string;
  actualTime?: string;
}

export interface Shipment {
  id: ID; // SHIP-000381
  loadId: ID;
  carrierId: ID;
  vehicleId: ID;
  driverId: ID;
  originId: ID;
  destinationId: ID;
  departureTime: string;
  etaTime: string;
  status: ShipmentStatus;
  stops: Stop[];
  occurrenceIds: ID[];
  deliveryId?: ID;
}

export type OccurrenceType =
  | "Atraso"
  | "Avaria"
  | "Destinatário ausente"
  | "Endereço incorreto"
  | "Problema mecânico"
  | "Acidente"
  | "Extravio"
  | "Roubo"
  | "Recusa"
  | "Devolução";

export type OccurrenceAction =
  | "Reagendar"
  | "Nova tentativa"
  | "Devolver"
  | "Contatar cliente";

export interface Occurrence {
  id: ID;
  shipmentId: ID;
  type: OccurrenceType;
  description: string;
  reportedAt: string;
  resolved: boolean;
  action?: OccurrenceAction;
  severity: "Baixa" | "Média" | "Crítica";
}

export type DeliveryResult =
  | "Delivered"
  | "Partial Delivery"
  | "Failed"
  | "Returned";

export interface Delivery {
  id: ID;
  shipmentId: ID;
  orderId: ID;
  customerId: ID;
  plannedWindowStart: string;
  plannedWindowEnd: string;
  arrivalTime?: string;
  completedAt?: string;
  result?: DeliveryResult;
  podDocumentId?: ID;
}

// ---------------------------------------------------------------------------
// Frete e documentos
// ---------------------------------------------------------------------------

export interface RateBracket {
  minKg: number;
  maxKg: number;
  price: number;
}

export interface Rate {
  id: ID;
  carrierId: ID;
  originState: string;
  destinationState: string;
  brackets: RateBracket[];
  toll: number;
  gris: number; // % sobre valor da carga
  adValorem: number; // % sobre valor da carga
  pickupFee: number;
  deliveryFee: number;
}

export interface Freight {
  id: ID;
  shipmentId: ID;
  rateId: ID;
  baseCost: number;
  toll: number;
  gris: number;
  adValorem: number;
  additionalFees: number;
  totalCost: number;
}

export type DocumentType =
  | "Ordem de Transporte"
  | "Romaneio"
  | "NF-e"
  | "CT-e"
  | "MDF-e"
  | "POD";

export interface TmsDocument {
  id: ID; // SIM-000381
  type: DocumentType;
  shipmentId: ID;
  simulated: true;
  issuedAt: string;
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export interface KpiSnapshot {
  date: string; // ISO date
  otifPercent: number;
  otdPercent: number;
  occupancyPercent: number;
  costPerDelivery: number;
  costPerKm: number;
}

// ---------------------------------------------------------------------------
// Grafo operacional completo (o que o gerador de simulação produz)
// ---------------------------------------------------------------------------

export interface OperationDataset {
  company: Company;
  locations: Location[];
  customers: Customer[];
  products: Product[];
  vehicles: Vehicle[];
  drivers: Driver[];
  carriers: Carrier[];
  orders: Order[];
  loads: Load[];
  tenders: Tender[];
  shipments: Shipment[];
  occurrences: Occurrence[];
  deliveries: Delivery[];
  rates: Rate[];
  freights: Freight[];
  documents: TmsDocument[];
  kpiHistory: KpiSnapshot[];
  orderEvents: OrderEvent[];
}

export interface OrderEvent {
  id: ID;
  orderId: ID;
  message: string;
  timestamp: string;
}
