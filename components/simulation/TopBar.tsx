"use client";

import { useState } from "react";
import { GlobalSearch } from "./GlobalSearch";
import { NewOrderModal } from "./NewOrderModal";

export function TopBar() {
  const [showNewOrder, setShowNewOrder] = useState(false);

  return (
    <>
      <div className="flex items-center gap-4 px-6 md:px-10 py-2.5 border-b border-cosmic-ink/10 bg-white/40">
        <GlobalSearch />
        <button
          onClick={() => setShowNewOrder(true)}
          className="ml-auto shrink-0 rounded-md bg-blue-opal text-white text-sm font-medium px-3.5 py-1.5 hover:bg-blue-opal/90 transition-colors"
        >
          + Novo Pedido
        </button>
      </div>
      {showNewOrder && <NewOrderModal onClose={() => setShowNewOrder(false)} />}
    </>
  );
}
