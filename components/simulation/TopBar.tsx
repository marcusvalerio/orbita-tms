"use client";

import { useState } from "react";
import Link from "next/link";
import { GlobalSearch } from "./GlobalSearch";
import { NewOrderModal } from "./NewOrderModal";
import { OrbitaMark } from "@/components/ui/OrbitaMark";

export function TopBar() {
  const [showSearch, setShowSearch] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-2 border-b border-cosmic-ink/10 bg-white/40 relative">
        <Link href="/" className="flex items-center gap-1.5 shrink-0">
          <OrbitaMark size={16} />
          <span className="font-display font-semibold text-[15px] text-cosmic-ink tracking-tight">
            ÓRBITA TMS
          </span>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <button type="button"
              onClick={() => setShowSearch((v) => !v)}
              aria-label="Pesquisar"
              title="Pesquisar"
              className="h-8 w-8 rounded-full border border-cosmic-ink/15 text-cosmic-ink/70 hover:bg-cosmic-ink/5 flex items-center justify-center transition-colors"
            >
              <SearchIcon />
            </button>
            {showSearch && (
              <div className="absolute right-0 top-10 z-30 w-80">
                <GlobalSearch autoFocus onNavigate={() => setShowSearch(false)} />
              </div>
            )}
          </div>

          <button type="button"
            onClick={() => setShowNewOrder(true)}
            aria-label="Novo Pedido"
            title="Novo Pedido"
            className="h-8 w-8 rounded-full bg-blue-opal text-white hover:bg-blue-opal/90 flex items-center justify-center transition-colors"
          >
            <PlusIcon />
          </button>
        </div>
      </div>
      {showNewOrder && <NewOrderModal onClose={() => setShowNewOrder(false)} />}
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
