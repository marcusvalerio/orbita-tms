import { Status } from "@/components/ds";
import { STATUS, statusSpec, type StatusEntity } from "@/lib/ui/status";

// Compatibilidade: telas ainda não migradas passam só o valor do status.
// Resolve a entidade pelo valor e delega ao <Status> do DS 2.0.
const ORDER: StatusEntity[] = ["shipment", "order", "load", "solicitation", "delivery"];

function entityFor(status: string): StatusEntity {
  return ORDER.find((e) => status in STATUS[e]) ?? "shipment";
}

export function statusLabel(status: string): string {
  return statusSpec(entityFor(status), status).label;
}

export function StatusBadge({ status }: { status: string }) {
  return <Status entity={entityFor(status)} value={status} size="sm" />;
}
