import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { ShipmentsWorkspace } from "./ShipmentsWorkspace";

export const metadata = { title: "Viagens" };

export default function ShipmentsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ShipmentsWorkspace />
    </Suspense>
  );
}
