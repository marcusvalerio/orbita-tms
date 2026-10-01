import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAppMode } from "@/lib/config/runtime";
import { OrbitaMark } from "@/components/ui/OrbitaMark";
import { SignInForm } from "./SignInForm";

export const metadata = { title: "Entrar" };

export default async function SignInPage() {
  await connection();
  if (getAppMode() === "demo") redirect("/");

  return (
    <main id="conteudo" className="flex min-h-dvh items-center justify-center bg-chrome px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 text-chrome-fg">
          <OrbitaMark size={20} variant="inverted" />
          <span className="font-display text-[17px] font-semibold tracking-tight">ÓRBITA TMS</span>
        </div>
        <SignInForm />
      </div>
    </main>
  );
}
