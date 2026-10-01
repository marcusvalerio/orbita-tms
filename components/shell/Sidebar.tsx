"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { OrbitaMark } from "@/components/ui/OrbitaMark";
import { Tooltip } from "@/components/ds";
import { useOperation } from "@/components/operation/OperationProvider";
import { cn } from "@/lib/ui/cn";
import { NAV, isActive, type NavItem } from "./navigation";

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { data, can, mode, companyName, actor, roleLabel } = useOperation();

  return (
    <aside
      aria-label="Navegação principal"
      className={cn(
        "hidden shrink-0 flex-col bg-chrome text-chrome-fg md:flex",
        "transition-[width] duration-(--orb-duration-base) ease-standard",
        collapsed ? "w-(--orb-sidebar-w-collapsed)" : "w-(--orb-sidebar-w)"
      )}
    >
      <div className={cn("flex h-(--orb-header-h) shrink-0 items-center border-b border-white/8", collapsed ? "justify-center" : "gap-2 px-4")}>
        <Link href="/" className="flex items-center gap-2 rounded-sm" aria-label="ÓRBITA — Command Center">
          <OrbitaMark size={18} variant="inverted" />
          {!collapsed && (
            <span className="font-display text-[15px] font-semibold tracking-tight">
              ÓRBITA <span className="font-sans text-caption font-medium text-chrome-muted">TMS</span>
            </span>
          )}
        </Link>
      </div>

      <nav aria-label="Áreas" className="orb-scroll flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((group) => {
          const items = group.items.filter((i) => (!i.permission || can(i.permission)));
          if (items.length === 0) return null;
          return (
            <div key={group.id} className="mb-4 last:mb-0">
              {collapsed ? (
                <div aria-hidden className="mx-3 mb-2 h-px bg-white/8" />
              ) : (
                <p className="mb-1 px-2 text-caption font-medium text-chrome-muted">{group.label}</p>
              )}
              <ul className="space-y-px">
                {items.map((item) => (
                  <li key={item.id}>
                    <SideLink item={item} active={isActive(item, pathname)} collapsed={collapsed} count={item.badge?.(data) ?? 0} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className={cn("border-t border-white/8 py-2", collapsed ? "px-2" : "px-3")}>
        {!collapsed && (
          <div className="mb-2 px-1">
            <p className="truncate text-body-sm text-chrome-fg">{companyName}</p>
            <p className="truncate text-caption text-chrome-muted">
              {actor.name} · <span>{roleLabel}</span>
            </p>
            <p className="flex items-center gap-1.5 text-caption text-chrome-muted">
              <span aria-hidden className={cn("size-1.5 rounded-full", mode === "demo" ? "bg-chrome-warning" : "bg-chrome-success")} />
              {mode === "demo" ? "Modo Demo · dados simulados" : "Produção"}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-sm px-2 text-body-sm text-chrome-muted hover:bg-chrome-hover hover:text-chrome-fg",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? <PanelLeft className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
          {!collapsed && "Recolher"}
        </button>
      </div>
    </aside>
  );
}

function SideLink({ item, active, collapsed, count }: { item: NavItem; active: boolean; collapsed: boolean; count: number }) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? (count ? `${item.label}, ${count}` : item.label) : undefined}
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-sm text-body-sm",
        "transition-colors duration-(--orb-duration-instant)",
        collapsed ? "justify-center" : "px-2",
        active ? "bg-chrome-hover text-chrome-fg" : "text-chrome-muted hover:bg-chrome-hover hover:text-chrome-fg"
      )}
    >
      {active && <span aria-hidden className="absolute -left-2 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand" />}
      <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "")} aria-hidden />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {count > 0 &&
        (collapsed ? (
          <span aria-hidden className={cn("absolute right-2 top-1.5 size-1.5 rounded-full", item.badgeTone === "attention" ? "bg-chrome-danger" : "bg-chrome-muted")} />
        ) : (
          <span
            className={cn(
              "tabular min-w-5 rounded-xs px-1 text-center text-caption font-medium",
              item.badgeTone === "attention" ? "bg-chrome-danger/15 text-chrome-danger" : "text-chrome-muted"
            )}
          >
            {count}
          </span>
        ))}
    </Link>
  );
  return collapsed ? (
    <Tooltip side="right" content={count ? `${item.label} · ${count}` : item.label}>
      {link}
    </Tooltip>
  ) : (
    link
  );
}
