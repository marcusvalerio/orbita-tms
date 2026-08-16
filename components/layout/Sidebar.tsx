"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { label: "Orders", href: "/orders" },
      { label: "Loads", href: "/loads" },
      { label: "Shipments", href: "/shipments" },
      { label: "Deliveries", href: "/deliveries" },
      { label: "Occurrences", href: "/occurrences" },
    ],
  },
  {
    label: "Planning",
    items: [
      { label: "Planning", href: "/planning" },
      { label: "Carriers", href: "/carriers" },
      { label: "Fleet", href: "/fleet" },
      { label: "Rates", href: "/rates" },
    ],
  },
  {
    label: "Documents",
    items: [{ label: "Documents", href: "/documents" }],
  },
  {
    label: "Performance",
    items: [
      { label: "KPIs", href: "/kpis" },
      { label: "Carrier Performance", href: "/carrier-performance" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col h-screen bg-cosmic-ink text-milk-mustache shrink-0">
      <div className="px-6 py-6 border-b border-white/10">
        <Link href="/" className="block">
          <span className="font-display font-semibold text-lg tracking-tight">
            ÓRBITA <span className="text-rowdy-orange">TMS</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <NavLink href="/" label="Overview" active={pathname === "/"} isTopLevel />

        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[11px] font-medium uppercase tracking-wider text-white/40">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={pathname === item.href}
                />
              ))}
            </div>
          </div>
        ))}
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
}: {
  href: string;
  label: string;
  active: boolean;
  isTopLevel?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "block rounded-md px-3 py-1.5 text-sm transition-colors",
        isTopLevel ? "font-medium mb-2" : "",
        active
          ? "bg-blue-opal text-white"
          : "text-white/70 hover:text-white hover:bg-white/5",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
