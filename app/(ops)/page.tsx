import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { CommandCenter } from "./CommandCenter";

export const metadata = { title: "Command Center" };

export default function CommandCenterPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando operação…" />}>
      <CommandCenter />
    </Suspense>
  );
}
