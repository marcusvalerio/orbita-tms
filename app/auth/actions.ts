"use server";

import { redirect } from "next/navigation";
import { getIdentityProvider } from "@/lib/auth";

export async function signIn(_prev: { error: string } | null, formData: FormData): Promise<{ error: string } | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const result = await getIdentityProvider().signInWithPassword(email, password);
  if (!result.ok) return { error: result.error };
  redirect("/");
}

export async function signOut() {
  await getIdentityProvider().signOut();
  redirect("/auth/sign-in");
}
