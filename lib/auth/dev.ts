import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDevAuthConfig } from "../config/runtime";
import type { Identity, IdentityProvider, SignInResult } from "./types";

// Provedor de identidade LOCAL para desenvolvimento e E2E quando o Neon Auth
// não é alcançável (ex.: rede restrita). Opt-in explícito, bloqueado em
// produção (ver getDevAuthConfig). Sessão = cookie HttpOnly assinado com HMAC.
// A autorização continua 100% real: exige vínculo na tabela memberships.

export const DEV_SESSION_COOKIE = "orbita_dev_session";
const MAX_AGE_S = 8 * 60 * 60;

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function encodeDevSession(email: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ email: email.toLowerCase(), exp: now + MAX_AGE_S * 1000 })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeDevSession(token: string | undefined, secret: string, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { email, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof email === "string" && typeof exp === "number" && exp > now ? email : null;
  } catch {
    return null;
  }
}

export const devIdentityProvider: IdentityProvider = {
  kind: "dev",
  async getIdentity(): Promise<Identity | null> {
    const { secret } = getDevAuthConfig();
    const email = decodeDevSession((await cookies()).get(DEV_SESSION_COOKIE)?.value, secret);
    return email ? { userId: `dev:${email}`, email, name: email.split("@")[0] } : null;
  },
  async signInWithPassword(email, password): Promise<SignInResult> {
    const config = getDevAuthConfig();
    const a = Buffer.from(password);
    const b = Buffer.from(config.password);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "E-mail ou senha incorretos." };
    (await cookies()).set(DEV_SESSION_COOKIE, encodeDevSession(email, config.secret), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.ORBITA_DEV_AUTH_INSECURE_COOKIE !== "true",
      path: "/",
      maxAge: MAX_AGE_S,
    });
    return { ok: true };
  },
  async signOut() {
    (await cookies()).delete(DEV_SESSION_COOKIE);
  },
};
