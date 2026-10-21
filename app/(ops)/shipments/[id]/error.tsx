"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, ErrorState } from "@/components/ds";

export default function ShipmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Erro na interface:", error.digest ?? error.message);
  }, [error]);
  return (
    <div className="grid flex-1 place-items-center">
      <ErrorState
        title="Não foi possível concluir a ação."
        description="A viagem não foi alterada. Tente novamente."
        action={
          <div className="flex gap-2">
            <Button variant="primary" onClick={reset}>
              Tentar novamente
            </Button>
            <Button asChild>
              <Link href="/shipments">Voltar para Viagens</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
