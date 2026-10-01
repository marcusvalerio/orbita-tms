import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Map as MapIcon,
  Route,
  PackageCheck,
  Siren,
  ClipboardList,
  Waypoints,
  Boxes,
  Truck,
  IdCard,
  Building,
  Handshake,
  Settings,
} from "lucide-react";
import type { OperationDataset } from "@/lib/domain/types";
import type { Permission } from "@/lib/authz/rbac";

// Arquitetura de informação do ÓRBITA 2.0 (docs/orbita-2.0/phase-2/PLAN.md §4).
// Organizada pelo trabalho do operador — durante (Operação), antes
// (Planejamento), com o quê (Recursos) — e não pela lista de cadastros.
// Só entra aqui o que existe: nenhum item "Em breve".

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Prefixos de rota que acendem este item. */
  match?: string[];
  permission?: Permission;
  /** Contador de atenção (só mostrado quando > 0). */
  badge?: (data: OperationDataset) => number;
  badgeTone?: "attention" | "neutral";
  /** Descrição curta para o Command Menu. */
  keywords?: string;
  /** Tela ainda não migrada para a 2.0 (some da navegação até existir). */
  pending?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const openOccurrences = (d: OperationDataset) => d.occurrences.filter((o) => !o.resolved).length;
const newSolicitations = (d: OperationDataset) => (d.solicitations ?? []).filter((s) => s.status === "Solicitada" || s.status === "Em análise").length;
const awaitingPlanning = (d: OperationDataset) => d.orders.filter((o) => o.status === "Aguardando planejamento").length;
const awaitingContract = (d: OperationDataset) => d.loads.filter((l) => l.status === "Aguardando transporte").length;

export const NAV: NavGroup[] = [
  {
    id: "operacao",
    label: "Operação",
    items: [
      { id: "central", label: "Command Center", href: "/", icon: LayoutDashboard, keywords: "central visão operacional painel agora" },
      { id: "mapa", label: "Mapa", href: "/mapa", icon: MapIcon, keywords: "rotas rastreamento simulação veículos" },
      { id: "viagens", label: "Viagens", href: "/shipments", icon: Route, match: ["/shipments"], keywords: "rotas execução" },
      { id: "entregas", label: "Entregas", href: "/deliveries", icon: PackageCheck, keywords: "janela pod comprovante" },
      { id: "ocorrencias", label: "Ocorrências", href: "/occurrences", icon: Siren, badge: openOccurrences, badgeTone: "attention", keywords: "exceções incidentes" },
    ],
  },
  {
    id: "planejamento",
    label: "Planejamento",
    items: [
      { id: "pedidos", label: "Pedidos", href: "/orders", icon: ClipboardList, match: ["/orders", "/solicitacoes"], badge: newSolicitations, badgeTone: "attention", keywords: "ordens de serviço solicitações caixa de entrada" },
      { id: "planejamento", label: "Planejamento", href: "/planning", icon: Waypoints, badge: awaitingPlanning, badgeTone: "neutral", keywords: "consolidação alternativas" },
      { id: "cargas", label: "Cargas", href: "/loads", icon: Boxes, match: ["/loads", "/contratacao"], badge: awaitingContract, badgeTone: "neutral", keywords: "contratação cotação transporte" },
    ],
  },
  {
    id: "recursos",
    label: "Recursos",
    items: [
      { id: "frota", label: "Frota", href: "/fleet", pending: true, icon: Truck, keywords: "veículos placas" },
      { id: "motoristas", label: "Motoristas", href: "/drivers", pending: true, icon: IdCard, keywords: "condutores cnh" },
      { id: "transportadoras", label: "Transportadoras", href: "/carriers", pending: true, icon: Building, keywords: "terceiros sla otif" },
      { id: "parceiros", label: "Parceiros", href: "/parceiros", icon: Handshake, permission: "partners:manage", keywords: "empresas parceiras portal código" },
    ],
  },
  {
    id: "configuracao",
    label: "Configuração",
    items: [{ id: "preferencias", label: "Preferências", href: "/config/preferencias", icon: Settings, keywords: "modo demo reiniciar cenário" }],
  },
];

/** Cinco destinos do mobile: o que o operador faz em campo/em pé. O resto vai para "Mais". */
export const MOBILE_PRIMARY = ["central", "mapa", "viagens", "ocorrencias"] as const;

export const ALL_ITEMS = NAV.flatMap((g) => g.items.map((item) => ({ ...item, group: g.label })));

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return [item.href, ...(item.match ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function activeItem(pathname: string) {
  return ALL_ITEMS.find((i) => isActive(i, pathname));
}
