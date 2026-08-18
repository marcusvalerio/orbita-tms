"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSimulation } from "./SimulationProvider";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

interface SearchGroup {
  title: string;
  results: SearchResult[];
}

export function GlobalSearch({
  autoFocus,
  onNavigate,
}: {
  autoFocus?: boolean;
  onNavigate?: () => void;
} = {}) {
  const { data } = useSimulation();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(!!autoFocus);
  const inputRef = useRef<HTMLInputElement>(null);

  const customerById = useMemo(() => new Map(data.customers.map((c) => [c.id, c])), [data.customers]);

  const groups: SearchGroup[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const orderResults: SearchResult[] = data.orders
      .filter((o) => {
        const customerName = customerById.get(o.customerId)?.name ?? "";
        return o.id.toLowerCase().includes(q) || customerName.toLowerCase().includes(q);
      })
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        label: o.id,
        sublabel: customerById.get(o.customerId)?.name,
        href: "/orders",
      }));

    const loadResults: SearchResult[] = data.loads
      .filter((l) => l.id.toLowerCase().includes(q))
      .slice(0, 5)
      .map((l) => ({ id: l.id, label: l.id, sublabel: `${l.totalWeightKg.toLocaleString("pt-BR")} kg`, href: "/orders" }));

    const shipmentResults: SearchResult[] = data.shipments
      .filter((s) => s.id.toLowerCase().includes(q))
      .slice(0, 5)
      .map((s) => ({ id: s.id, label: s.id, sublabel: s.status, href: `/shipments/${s.id}` }));

    const carrierResults: SearchResult[] = data.carriers
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((c) => ({ id: c.id, label: c.name, sublabel: "Transportadora", href: "/carriers" }));

    const groupsOut: SearchGroup[] = [];
    if (orderResults.length) groupsOut.push({ title: "Pedidos", results: orderResults });
    if (loadResults.length) groupsOut.push({ title: "Cargas", results: loadResults });
    if (shipmentResults.length) groupsOut.push({ title: "Viagens", results: shipmentResults });
    if (carrierResults.length) groupsOut.push({ title: "Transportadoras", results: carrierResults });
    return groupsOut;
  }, [query, data, customerById]);

  const handleSelect = (result: SearchResult) => {
    router.push(result.href);
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
    onNavigate?.();
  };

  const hasResults = groups.length > 0;
  const showPanel = focused && query.trim().length >= 2;

  return (
    <div className="relative w-full max-w-md">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Pesquisar no ÓRBITA..."
        className="w-full rounded-md border border-cosmic-ink/15 bg-white/70 px-3 py-1.5 text-sm text-cosmic-ink placeholder:text-cosmic-ink/40 focus:outline-none focus:ring-1 focus:ring-blue-opal"
      />

      {showPanel && (
        <div className="absolute left-0 right-0 mt-1 rounded-md border border-cosmic-ink/10 bg-white shadow-lg z-20 max-h-96 overflow-y-auto">
          {!hasResults && (
            <p className="px-4 py-3 text-sm text-cosmic-ink/45">Nenhum resultado para &ldquo;{query}&rdquo;.</p>
          )}
          {groups.map((group) => (
            <div key={group.title} className="py-1">
              <p className="px-4 py-1 text-[10px] uppercase tracking-wider text-cosmic-ink/40">{group.title}</p>
              {group.results.map((result) => (
                <button type="button"
                  key={`${group.title}-${result.id}`}
                  onMouseDown={() => handleSelect(result)}
                  className="w-full text-left px-4 py-2 hover:bg-blue-opal/5 flex items-center justify-between gap-3"
                >
                  <span className="font-display font-medium text-sm text-cosmic-ink">{result.label}</span>
                  {result.sublabel && <span className="text-xs text-cosmic-ink/50 truncate">{result.sublabel}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
