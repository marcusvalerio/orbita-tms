"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  ready?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Central Operacional",
    items: [
      { label: "Pedidos", href: "/orders", ready: true },
      { label: "Cargas", href: "/loads" },
      { label: "Viagens", href: "/shipments", ready: true },
      { label: "Entregas", href: "/deliveries" },
      { label: "Ocorrências", href: "/occurrences" },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { label: "Planejamento de Transporte", href: "/planning", ready: true },
      { label: "Consolidação de Cargas", href: "/planning#cargas" },
      { label: "Rotas", href: "/rotas" },
      { label: "Transportadoras", href: "/carriers" },
      { label: "Frota", href: "/fleet" },
      { label: "Tabelas de Frete", href: "/rates" },
    ],
  },
  {
    label: "Documentação",
    items: [
      { label: "Documentos", href: "/documents" },
      { label: "CT-e", href: "/documents#cte" },
      { label: "MDF-e", href: "/documents#mdfe" },
      { label: "Romaneios", href: "/documents#romaneios" },
      { label: "Comprovantes de Entrega", href: "/documents#pod" },
    ],
  },
  {
    label: "Desempenho",
    items: [
      { label: "Indicadores", href: "/kpis" },
      { label: "Desempenho das Transportadoras", href: "/carrier-performance" },
      { label: "Custos", href: "/custos" },
      { label: "Análises", href: "/analises" },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { label: "Clientes", href: "/clientes" },
      { label: "Produtos", href: "/produtos" },
      { label: "Locais", href: "/locais" },
      { label: "Veículos", href: "/fleet" },
      { label: "Motoristas", href: "/motoristas" },
      { label: "Transportadoras", href: "/carriers" },
    ],
  },
  {
    label: "Configurações",
    items: [
      { label: "Empresa", href: "/config/empresa" },
      { label: "Centros de Distribuição", href: "/config/cds" },
      { label: "Parâmetros Operacionais", href: "/config/parametros" },
      { label: "Preferências", href: "/config/preferencias", ready: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  // Central Operacional e Planejamento começam abertos por serem as áreas
  // funcionais hoje; as demais iniciam recolhidas.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Central Operacional": true,
    "Planejamento": true,
  });

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <aside className="hidden md:flex md:w-72 md:flex-col h-screen bg-cosmic-ink text-milk-mustache shrink-0">
      <div className="px-6 py-6 border-b border-white/10">
        <Link href="/" className="block">
          <span className="font-display font-semibold text-lg tracking-tight">
            ÓRBITA <span className="text-rowdy-orange">TMS</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavLink href="/" label="Visão Operacional" active={pathname === "/"} isTopLevel ready />

        {NAV_GROUPS.map((group) => {
          const isOpen = !!openGroups[group.label];
          return (
            <div key={group.label} className="pt-3">
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 mb-1 text-[11px] font-medium uppercase tracking-wider text-white/40 hover:text-white/60"
              >
                {group.label}
                <span className={`transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}>⌄</span>
              </button>
              {isOpen && (
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.ready ? item.href : "#"}
                      label={item.label}
                      active={pathname === item.href}
                      ready={item.ready}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-white/10 text-[11px] text-white/40">
        Atlas Distribuição · Sudeste
      </div>
    </aside>
  );
}

function NavLink({
  href,
  label,
  active,
  isTopLevel,
  ready,
}: {
  href: string;
  label: string;
  active: boolean;
  isTopLevel?: boolean;
  ready?: boolean;
}) {
  if (!ready) {
    return (
      <span className="flex items-center justify-between px-3 py-1.5 text-sm text-white/30 cursor-default">
        {label}
        <span className="text-[10px] uppercase tracking-wide bg-white/5 rounded px-1.5 py-0.5">
          Em breve
        </span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={[
        "block rounded-md px-3 py-1.5 text-sm transition-colors",
        isTopLevel ? "font-medium mb-2" : "",
        active ? "bg-blue-opal text-white" : "text-white/70 hover:text-white hover:bg-white/5",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
