import "server-only";
import { resolveBrowserKey, resolveServerKey } from "./google-keys";

// Configuração de execução, lida no servidor em tempo de requisição.
//
//   ORBITA_MODE=demo        (padrão) operação no navegador, sem banco nem login.
//   ORBITA_MODE=production  operação no Neon PostgreSQL, com Neon Auth e RBAC.
//
// O modo é decidido em runtime (não no build): o mesmo artefato roda nos dois.

export type AppMode = "demo" | "production";

export function getAppMode(): AppMode {
  return process.env.ORBITA_MODE === "production" ? "production" : "demo";
}

export type IdentityProviderKind = "neon" | "dev";

export function getIdentityProviderKind(): IdentityProviderKind {
  return process.env.ORBITA_AUTH_PROVIDER === "dev" ? "dev" : "neon";
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new ConfigurationError(`Variável de ambiente ${name} não configurada.`);
  return value;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function getDatabaseUrl(): string {
  return required("DATABASE_URL");
}

export function getNeonAuthConfig() {
  const secret = required("NEON_AUTH_COOKIE_SECRET");
  if (secret.length < 32) throw new ConfigurationError("NEON_AUTH_COOKIE_SECRET precisa ter 32+ caracteres.");
  return { baseUrl: required("NEON_AUTH_BASE_URL"), cookieSecret: secret };
}

/**
 * Provedor de identidade local, SÓ para desenvolvimento e testes E2E sem
 * acesso ao Neon Auth. Exige opt-in explícito e se recusa a ativar em
 * produção na Vercel.
 */
export function getDevAuthConfig() {
  if (process.env.ORBITA_ALLOW_INSECURE_DEV_AUTH !== "true") {
    throw new ConfigurationError("Autenticação de desenvolvimento desativada (ORBITA_ALLOW_INSECURE_DEV_AUTH).");
  }
  if (process.env.VERCEL_ENV === "production") {
    throw new ConfigurationError("Autenticação de desenvolvimento não pode rodar em produção.");
  }
  const secret = required("ORBITA_DEV_AUTH_SECRET");
  if (secret.length < 32) throw new ConfigurationError("ORBITA_DEV_AUTH_SECRET precisa ter 32+ caracteres.");
  return { secret, password: required("ORBITA_DEV_AUTH_PASSWORD") };
}

/**
 * Chave do Maps JavaScript API (GOOGLE_MAPS_BROWSER_KEY; alias legado
 * GOOGLE_MAPS_API_KEY) — exposta ao navegador por natureza; restrinja por referrer.
 */
export function getGoogleMapsBrowserKey(): string | null {
  return resolveBrowserKey(process.env)?.value ?? null;
}

/**
 * Chave server-side para Routes/Geocoding (GOOGLE_MAPS_SERVER_KEY; alias legado
 * GOOGLE_MAPS_SERVER_API_KEY). Nunca enviada ao navegador.
 */
export function getGoogleMapsServerKey(): string | null {
  return resolveServerKey(process.env)?.value ?? null;
}

export function getGoogleMapsMapId(): string {
  return process.env.GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
}
