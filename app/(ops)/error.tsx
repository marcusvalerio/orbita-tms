"use client";

import { useEffect } from "react";
import { Button, ErrorState } from "@/components/ds";

export default function OperationError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Erro na interface:", error.digest ?? error.message);
  }, [error]);
  return (
    <div className="grid flex-1 place-items-center">
      <ErrorState title="Não foi possível concluir a ação." description="A operação não foi alterada. Tente novamente." action={<Button variant="primary" onClick={reset}>Tentar novamente</Button>} />
    </div>
  );
}
