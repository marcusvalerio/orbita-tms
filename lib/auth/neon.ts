import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { getNeonAuthConfig } from "../config/runtime";
import type { Identity, IdentityProvider, SignInResult } from "./types";

type NeonAuth = ReturnType<typeof createNeonAuth>;
let instance: NeonAuth | null = null;

/** Instância única do Neon Auth (criada sob demanda: o Modo Demo não precisa dela). */
export function getNeonAuth(): NeonAuth {
  if (!instance) {
    const { baseUrl, cookieSecret } = getNeonAuthConfig();
    instance = createNeonAuth({ baseUrl, cookies: { secret: cookieSecret, sameSite: "lax" } });
  }
  return instance;
}

function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "Não foi possível entrar.";
  if (error.code?.startsWith("NETWORK_")) return "Serviço de autenticação indisponível. Tente novamente em instantes.";
  if (error.code === "INVALID_EMAIL_OR_PASSWORD" || /invalid/i.test(error.message ?? "")) return "E-mail ou senha incorretos.";
  return error.message || "Não foi possível entrar.";
}

export const neonIdentityProvider: IdentityProvider = {
  kind: "neon",
  async getIdentity(): Promise<Identity | null> {
    const { data } = await getNeonAuth().getSession();
    const user = data?.user;
    if (!user?.id || !user.email) return null;
    return { userId: user.id, email: user.email.toLowerCase(), name: user.name || user.email };
  },
  async signInWithPassword(email, password): Promise<SignInResult> {
    const { error } = await getNeonAuth().signIn.email({ email, password });
    return error ? { ok: false, error: friendlyError(error) } : { ok: true };
  },
  async signOut() {
    await getNeonAuth().signOut();
  },
};
