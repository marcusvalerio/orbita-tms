import type { OperationDataset } from "../../domain/types";

// Mapeamento declarativo domínio ↔ tabelas. Uma entrada por coleção do
// OperationDataset; o repositório usa estas specs para ler e para gravar só o
// que mudou. Campos ausentes no domínio (undefined) ↔ NULL no banco.

export type ColumnKind = "text" | "num" | "int" | "bool" | "ts" | "date" | "textArr" | "json";

export interface ColumnSpec {
  key: string; // campo no domínio
  col: string; // coluna no banco
  kind: ColumnKind;
}

export interface CollectionSpec {
  collection: keyof OperationDataset;
  table: string;
  /** Campo de domínio que identifica a linha (coluna `id`, exceto kpi_snapshots). */
  idKey: string;
  idCol: string;
  columns: ColumnSpec[];
  /** Campos do domínio que NÃO vão para esta tabela (filhos ou derivados). */
  omit?: string[];
}

const c = (key: string, col: string, kind: ColumnKind = "text"): ColumnSpec => ({ key, col, kind });

export const COLLECTIONS: CollectionSpec[] = [
  {
    collection: "locations",
    table: "locations",
    idKey: "id",
    idCol: "id",
    columns: [
      c("name", "name"), c("city", "city"), c("state", "state"), c("kind", "kind"),
      c("lat", "lat", "num"), c("lng", "lng", "num"), c("address", "address"), c("cep", "cep"),
      c("complement", "complement"), c("reference", "reference"), c("contactName", "contact_name"),
      c("contactPhone", "contact_phone"),
    ],
  },
  {
    collection: "customers",
    table: "customers",
    idKey: "id",
    idCol: "id",
    columns: [c("name", "name"), c("locationId", "location_id")],
  },
  {
    collection: "products",
    table: "products",
    idKey: "id",
    idCol: "id",
    columns: [c("name", "name"), c("category", "category")],
  },
  {
    collection: "vehicles",
    table: "vehicles",
    idKey: "id",
    idCol: "id",
    columns: [
      c("plate", "plate"), c("type", "type"), c("capacityKg", "capacity_kg", "num"),
      c("capacityM3", "capacity_m3", "num"), c("ownership", "ownership"), c("status", "status"),
    ],
  },
  {
    collection: "drivers",
    table: "drivers",
    idKey: "id",
    idCol: "id",
    columns: [c("name", "name"), c("cnhCategory", "cnh_category"), c("status", "status")],
  },
  {
    collection: "carriers",
    table: "carriers",
    idKey: "id",
    idCol: "id",
    columns: [
      c("name", "name"), c("regions", "regions", "textArr"), c("cargoTypes", "cargo_types", "textArr"),
      c("slaPercent", "sla_percent", "num"), c("otifPercent", "otif_percent", "num"),
      c("avgCostPerKm", "avg_cost_per_km", "num"), c("occurrenceRate", "occurrence_rate", "num"),
    ],
  },
  {
    collection: "rates",
    table: "rates",
    idKey: "id",
    idCol: "id",
    columns: [
      c("carrierId", "carrier_id"), c("originState", "origin_state"), c("destinationState", "destination_state"),
      c("brackets", "brackets", "json"), c("toll", "toll", "num"), c("gris", "gris", "num"),
      c("adValorem", "ad_valorem", "num"), c("pickupFee", "pickup_fee", "num"), c("deliveryFee", "delivery_fee", "num"),
    ],
  },
  {
    collection: "partnerCompanies",
    table: "partner_companies",
    idKey: "id",
    idCol: "id",
    columns: [
      c("legalName", "legal_name"), c("tradeName", "trade_name"), c("cnpj", "cnpj"),
      c("responsibleName", "responsible_name"), c("phone", "phone"), c("email", "email"), c("cep", "cep"),
      c("address", "address"), c("addressNumber", "address_number"), c("complement", "complement"),
      c("neighborhood", "neighborhood"), c("city", "city"), c("state", "state"), c("notes", "notes"),
      c("status", "status"), c("accessCode", "access_code"), c("createdAt", "registered_at", "ts"),
    ],
  },
  {
    collection: "orders",
    table: "orders",
    idKey: "id",
    idCol: "id",
    omit: ["items"],
    columns: [
      c("originId", "origin_id"), c("destinationId", "destination_id"), c("customerId", "customer_id"),
      c("totalWeightKg", "total_weight_kg", "num"), c("totalVolumeM3", "total_volume_m3", "num"),
      c("dueDate", "due_date", "date"), c("priority", "priority"), c("status", "status"), c("loadId", "load_id"),
      c("operationType", "operation_type"), c("requestedBy", "requested_by"), c("requestDate", "request_date", "ts"),
      c("generalNotes", "general_notes"), c("pickupDate", "pickup_date", "date"),
      c("pickupWindowStart", "pickup_window_start"), c("pickupWindowEnd", "pickup_window_end"),
      c("deliveryWindowStart", "delivery_window_start"), c("deliveryWindowEnd", "delivery_window_end"),
      c("destinationContactName", "destination_contact_name"), c("destinationContactPhone", "destination_contact_phone"),
      c("cargoCharacteristics", "cargo_characteristics", "textArr"), c("temperatureMin", "temperature_min", "num"),
      c("temperatureMax", "temperature_max", "num"), c("temperatureNotes", "temperature_notes"),
    ],
  },
  {
    collection: "loads",
    table: "loads",
    idKey: "id",
    idCol: "id",
    omit: ["orderIds"],
    columns: [
      c("originId", "origin_id"), c("destinationId", "destination_id"), c("totalWeightKg", "total_weight_kg", "num"),
      c("totalVolumeM3", "total_volume_m3", "num"), c("status", "status"), c("shipmentId", "shipment_id"),
    ],
  },
  {
    collection: "tenders",
    table: "tenders",
    idKey: "id",
    idCol: "id",
    columns: [c("loadId", "load_id"), c("options", "options", "json"), c("selectedOptionId", "selected_option_id")],
  },
  {
    collection: "shipments",
    table: "shipments",
    idKey: "id",
    idCol: "id",
    omit: ["stops", "occurrenceIds"],
    columns: [
      c("routeCode", "route_code"), c("loadId", "load_id"), c("carrierId", "carrier_id"), c("vehicleId", "vehicle_id"),
      c("driverId", "driver_id"), c("originId", "origin_id"), c("destinationId", "destination_id"),
      c("departureTime", "departure_time", "ts"), c("etaTime", "eta_time", "ts"), c("status", "status"),
      c("plannedDistanceKm", "planned_distance_km", "num"), c("plannedDurationMin", "planned_duration_min", "int"),
      c("deliveryId", "delivery_id"),
    ],
  },
  {
    collection: "freights",
    table: "freights",
    idKey: "id",
    idCol: "id",
    columns: [
      c("shipmentId", "shipment_id"), c("rateId", "rate_id"), c("label", "label"), c("baseCost", "base_cost", "num"),
      c("toll", "toll", "num"), c("gris", "gris", "num"), c("adValorem", "ad_valorem", "num"),
      c("additionalFees", "additional_fees", "num"), c("totalCost", "total_cost", "num"),
    ],
  },
  {
    collection: "occurrences",
    table: "occurrences",
    idKey: "id",
    idCol: "id",
    columns: [
      c("shipmentId", "shipment_id"), c("type", "type"), c("description", "description"),
      c("reportedAt", "reported_at", "ts"), c("resolved", "resolved", "bool"), c("resolvedAt", "resolved_at", "ts"),
      c("action", "action"), c("severity", "severity"),
    ],
  },
  {
    collection: "documents",
    table: "documents",
    idKey: "id",
    idCol: "id",
    columns: [c("type", "type"), c("shipmentId", "shipment_id"), c("simulated", "simulated", "bool"), c("issuedAt", "issued_at", "ts")],
  },
  {
    collection: "deliveries",
    table: "deliveries",
    idKey: "id",
    idCol: "id",
    columns: [
      c("shipmentId", "shipment_id"), c("orderId", "order_id"), c("customerId", "customer_id"),
      c("plannedWindowStart", "planned_window_start", "ts"), c("plannedWindowEnd", "planned_window_end", "ts"),
      c("arrivalTime", "arrival_time", "ts"), c("completedAt", "completed_at", "ts"), c("result", "result"),
      c("podDocumentId", "pod_document_id"),
    ],
  },
  {
    collection: "orderEvents",
    table: "order_events",
    idKey: "id",
    idCol: "id",
    columns: [c("orderId", "order_id"), c("message", "message"), c("timestamp", "occurred_at", "ts")],
  },
  {
    collection: "solicitations",
    table: "solicitations",
    idKey: "id",
    idCol: "id",
    columns: [
      c("partnerCompanyId", "partner_company_id"), c("requestedBy", "requested_by"), c("contact", "contact"),
      c("operationType", "operation_type"), c("originId", "origin_id"), c("destinationId", "destination_id"),
      c("pickupDate", "pickup_date", "date"), c("pickupWindowStart", "pickup_window_start"),
      c("pickupWindowEnd", "pickup_window_end"), c("deliveryDate", "delivery_date", "date"),
      c("deliveryWindowStart", "delivery_window_start"), c("deliveryWindowEnd", "delivery_window_end"),
      c("destinationContactName", "destination_contact_name"), c("destinationContactPhone", "destination_contact_phone"),
      c("productDescription", "product_description"), c("quantity", "quantity", "num"),
      c("totalWeightKg", "total_weight_kg", "num"), c("totalVolumeM3", "total_volume_m3", "num"), c("unit", "unit"),
      c("cargoCharacteristics", "cargo_characteristics", "textArr"), c("temperatureMin", "temperature_min", "num"),
      c("temperatureMax", "temperature_max", "num"), c("temperatureNotes", "temperature_notes"),
      c("nfeNumber", "nfe_number"), c("romaneioNumber", "romaneio_number"), c("otherDocuments", "other_documents"),
      c("notes", "notes"), c("status", "status"), c("orderId", "order_id"), c("createdAt", "submitted_at", "ts"),
    ],
  },
  {
    collection: "kpiHistory",
    table: "kpi_snapshots",
    idKey: "date",
    idCol: "date",
    columns: [
      c("otifPercent", "otif_percent", "num"), c("otdPercent", "otd_percent", "num"),
      c("occupancyPercent", "occupancy_percent", "num"), c("costPerDelivery", "cost_per_delivery", "num"),
      c("costPerKm", "cost_per_km", "num"),
    ],
  },
];

export const COUNTER_COLUMNS: Record<keyof OperationDataset["counters"], string> = {
  order: "order_next",
  load: "load_next",
  shipment: "shipment_next",
  delivery: "delivery_next",
  occurrence: "occurrence_next",
  document: "document_next",
  pod: "pod_next",
  event: "event_next",
  partner: "partner_next",
  solicitation: "solicitation_next",
};

// --- Conversões ------------------------------------------------------------------

export function toDb(value: unknown, kind: ColumnKind): unknown {
  if (value === undefined || value === null) return null;
  switch (kind) {
    case "date":
      return String(value).slice(0, 10);
    case "json":
      return JSON.stringify(value);
    default:
      return value;
  }
}

export function fromDb(value: unknown, kind: ColumnKind): unknown {
  if (value === null || value === undefined) return undefined;
  switch (kind) {
    case "num":
    case "int":
      return typeof value === "number" ? value : Number(value);
    case "ts":
      return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
    case "date":
      return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    default:
      return value;
  }
}

/** Remove chaves com undefined — forma canônica usada para comparar entidades. */
export function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export function rowToEntity(spec: CollectionSpec, row: Record<string, unknown>): Record<string, unknown> {
  const entity: Record<string, unknown> = { [spec.idKey]: fromDb(row[spec.idCol], spec.idCol === "date" ? "date" : "text") };
  for (const col of spec.columns) entity[col.key] = fromDb(row[col.col], col.kind);
  if (spec.collection === "documents") entity.simulated = true;
  return compact(entity);
}
