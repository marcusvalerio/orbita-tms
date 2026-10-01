import { withOperation } from "@/lib/server/operation-context";
import { OperationToaster } from "@/components/shell/AppShell";
import { TooltipProvider } from "@/components/ds";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  return withOperation(
    "partner",
    <TooltipProvider>
      {children}
      <OperationToaster />
    </TooltipProvider>
  );
}
