import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAppMode } from "@/lib/config/runtime";
import { OrbitaMark } from "@/components/ui/OrbitaMark";
import { SignInForm } from "./SignInForm";

export const metadata = { title: "Entrar · ÓRBITA TMS" };

export default async function SignInPage() {
  await connection();
  if (getAppMode() === "demo") redirect("/");

  return (
    <main className="min-h-screen flex items-center justify-center bg-cosmic-ink px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6 text-milk-mustache">
          <OrbitaMark size={20} variant="inverted" />
          <span className="font-display font-semibold text-lg tracking-tight">ÓRBITA TMS</span>
        </div>
        <SignInForm />
      </div>
    </main>
  );
}
