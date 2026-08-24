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
  address?: string;
  cep?: string;
  complement?: string;
  reference?: string;
  contactName?: string;
  contactPhone?: string;
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
  productId?: ID; // ausente quando o item não está no catálogo — usa `description`
  description?: string;
  quantity: number;
  unitWeightKg: number;
  weightKg: number; // total do item = quantity × unitWeightKg
  volumeM3?: number;
}

export type CargoCharacteristic =
  | "Refrigerada"
  | "Congelada"
  | "Temperatura ambiente"
  | "Frágil"
  | "Alto valor"
  | "Perigosa"
  | "Perecível"
  | "Sensível à umidade"
  | "Manuseio especial";

export interface Order {
  id: ID; // PED-10482
  originId: ID;
  destinationId: ID;
  customerId: ID;
  items: OrderItem[];
  totalWeightKg: number;
  totalVolumeM3: number;
  dueDate: string; // ISO date — data prevista de entrega
  priority: "Normal" | "Alta" | "Urgente";
  status: OrderStatus;
  loadId?: ID;
  // Identificação da operação
  operationType: "B2B" | "B2C" | "Outro";
  requestedBy?: string;
  requestDate: string; // ISO datetime
  generalNotes?: string;
  // Coleta
  pickupDate: string; // ISO date
  pickupWindowStart?: string; // HH:MM
  pickupWindowEnd?: string; // HH:MM
  // Entrega
  deliveryWindowStart?: string; // HH:MM
  deliveryWindowEnd?: string; // HH:MM
  destinationContactName?: string;
  destinationContactPhone?: string;
  // Características da carga
  cargoCharacteristics: CargoCharacteristic[];
  temperatureMin?: number;
  temperatureMax?: number;
  temperatureNotes?: string;
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
  counters: EntityCounters;
  partnerCompanies: PartnerCompany[];
  solicitations: Solicitation[];
}

export interface OrderEvent {
  id: ID;
  orderId: ID;
  message: string;
  timestamp: string;
}

/** Contadores sequenciais persistentes — origem dos identificadores como PED-00001, CAR-00001 etc. */
export interface EntityCounters {
  order: number;
  load: number;
  shipment: number;
  delivery: number;
  occurrence: number;
  document: number;
  pod: number;
  event: number;
  partner: number;
  solicitation: number;
}

/** Empresa parceira — quem contrata a operadora e solicita transportes. */
export interface PartnerCompany {
  id: ID;
  legalName: string;
  tradeName?: string;
  cnpj?: string;
  responsibleName?: string;
  phone?: string;
  email?: string;
  cep?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
  status: "Ativa" | "Inativa";
  accessCode: string; // ex: FSC-4821 — mecanismo provisório de acesso ao Portal do Parceiro
  createdAt: string;
}

export type SolicitationStatus = "Solicitada" | "Em análise" | "Convertida em Pedido" | "Recusada";

/** Solicitação enviada pelo parceiro — origem da demanda, antes de virar Pedido/Ordem de Serviço. */
export interface Solicitation {
  id: ID; // SOL-00001
  partnerCompanyId: ID;
  requestedBy?: string;
  contact?: string;
  operationType: "B2B" | "B2C";
  originId: ID;
  destinationId: ID;
  pickupDate: string;
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  deliveryDate: string;
  deliveryWindowStart?: string;
  deliveryWindowEnd?: string;
  destinationContactName?: string;
  destinationContactPhone?: string;
  productDescription: string;
  quantity: number;
  totalWeightKg: number;
  totalVolumeM3?: number;
  unit?: string;
  cargoCharacteristics: CargoCharacteristic[];
  temperatureMin?: number;
  temperatureMax?: number;
  temperatureNotes?: string;
  nfeNumber?: string;
  romaneioNumber?: string;
  otherDocuments?: string;
  notes?: string;
  status: SolicitationStatus;
  orderId?: ID;
  createdAt: string;
}
