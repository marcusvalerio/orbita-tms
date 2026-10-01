import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAppMode, ConfigurationError } from "../config/runtime";
import { resolveSession } from "./session";
import { getProductionDeps } from "./container";
import { readOperation } from "../application/execute-command";
import { runOperationCommand, refreshOperation } from "./operation-actions";
import { OperationProvider } from "@/components/operation/OperationProvider";
import { DEMO_ACTOR } from "../authz/rbac";

/**
 * Monta o OperationProvider para uma área da aplicação, no modo certo.
 * `audience` define quem pode entrar: a operação interna ou o parceiro.
 */
export async function withOperation(audience: "operation" | "partner", children: React.ReactNode) {
  // Sempre renderizado por requisição: o modo e a sessão são decididos em runtime.
  await connection();

  if (getAppMode() === "demo") {
    return (
      <OperationProvider mode="demo" actor={DEMO_ACTOR}>
        {children}
      </OperationProvider>
    );
  }

  let session;
  try {
    session = await resolveSession();
  } catch (err) {
    if (err instanceof ConfigurationError) return <SetupRequired message={err.message} />;
    throw err;
  }
  if (session.status === "anonymous") redirect("/auth/sign-in");
  if (session.status === "no-membership") redirect("/acesso-pendente");

  const { actor } = session;
  if (audience === "operation" && actor.role === "parceiro") redirect("/portal");
  if (audience === "partner" && actor.role !== "parceiro") redirect("/");

  const data = await readOperation(getProductionDeps(), actor);
  if (!data) return <SetupRequired message={`A empresa "${actor.tenantId}" não foi inicializada no banco (npm run db:seed).`} />;

  return (
    <OperationProvider
      mode="production"
      actor={actor}
      companyName={session.companyName}
      initialData={data}
      server={{ runCommand: runOperationCommand, refresh: refreshOperation }}
    >
      {children}
    </OperationProvider>
  );
}

function SetupRequired({ message }: { message: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="max-w-md rounded-lg border border-line-subtle bg-surface p-6 shadow-2" role="alert">
        <h1 className="font-display text-h1 text-fg">Configuração do Modo Produção incompleta</h1>
        <p className="mt-1 text-body text-fg-muted">{message}</p>
        <p className="mt-3 text-body-sm text-fg-muted">Veja docs/orbita-2.0/phase-1/SETUP.md.</p>
      </div>
    </main>
  );
}
