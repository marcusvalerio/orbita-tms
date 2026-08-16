"use client";

import { useSimulation } from "./SimulationProvider";

export function ToastStack() {
  const { toasts } = useSimulation();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-xs">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-md bg-cosmic-ink text-milk-mustache text-sm px-4 py-2.5 shadow-lg"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
