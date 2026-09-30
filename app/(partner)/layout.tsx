import { withOperation } from "@/lib/server/operation-context";
import { ToastStack } from "@/components/simulation/ToastStack";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  return withOperation(
    "partner",
    <>
      {children}
      <ToastStack />
    </>
  );
}
