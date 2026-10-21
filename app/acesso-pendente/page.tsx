import { connection } from "next/server";
import { signOut } from "../auth/actions";
import { OrbitaMark } from "@/components/ui/OrbitaMark";

export const metadata = { title: "Acesso pendente" };

export default async function AccessPendingPage() {
  await connection();
  return (
    <main id="conteudo" className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-lg border border-line-subtle bg-surface p-6 shadow-2">
        <OrbitaMark size={18} />
        <h1 className="mt-4 font-display text-h1 text-fg">Acesso pendente</h1>
        <p className="mt-1 text-body text-fg-muted">
          Sua identidade foi confirmada, mas você ainda não está vinculado a nenhuma empresa no ÓRBITA. Peça ao administrador da operação para liberar o seu acesso.
        </p>
        <form action={signOut} className="mt-5">
          <button type="submit" className="h-8 rounded-sm border border-line px-3 text-body font-medium text-fg hover:bg-surface-hover">
            Sair e usar outra conta
          </button>
        </form>
      </div>
    </main>
  );
}
