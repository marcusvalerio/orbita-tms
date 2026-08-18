"use client";

import Link from "next/link";

export default function ShipmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div>
        <p className="font-display font-semibold text-lg text-cosmic-ink mb-1">
          Não foi possível concluir a ação
        </p>
        <p className="text-sm text-cosmic-ink/60">A operação não foi alterada. Tente novamente.</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-blue-opal text-white text-sm font-medium px-4 py-2 hover:bg-blue-opal/90 transition-colors"
        >
          Tentar novamente
        </button>
        <Link
          href="/shipments"
          className="rounded-md border border-cosmic-ink/15 text-cosmic-ink text-sm font-medium px-4 py-2 hover:bg-cosmic-ink/5 transition-colors"
        >
          Voltar para Viagens
        </Link>
      </div>
    </div>
  );
}
