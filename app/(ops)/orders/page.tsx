import { Suspense } from "react";
import { LoadingState } from "@/components/ds";
import { OrdersHub } from "./OrdersHub";

export const metadata = { title: "Pedidos" };

export default function OrdersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <OrdersHub />
    </Suspense>
  );
}
