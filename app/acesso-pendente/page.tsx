import { connection } from "next/server";
import { signOut } from "../auth/actions";

export const metadata = { title: "Acesso pendente · ÓRBITA TMS" };

export default async function AccessPendingPage() {
  await connection();
  return (
    <main className="min-h-screen flex items-center justify-center bg-milk-mustache px-4">
      <div className="max-w-md rounded-lg border border-cosmic-ink/15 bg-white px-6 py-5">
        <h1 className="font-display font-semibold text-lg text-cosmic-ink mb-1">Acesso pendente</h1>
        <p className="text-sm text-cosmic-ink/75">
          Sua identidade foi confirmada, mas você ainda não está vinculado a nenhuma empresa no ÓRBITA. Peça ao
          administrador da operação para liberar o seu acesso.
        </p>
        <form action={signOut} className="mt-4">
          <button type="submit" className="text-sm font-medium text-cosmic-ink underline underline-offset-4">
            Sair e usar outra conta
          </button>
        </form>
      </div>
    </main>
  );
}
