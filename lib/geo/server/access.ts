import "server-only";
import { headers } from "next/headers";
import { getAppMode } from "../../config/runtime";
import { resolveSession } from "../../server/session";
import { can } from "../../authz/rbac";
import { RateLimiter } from "./guards";

const limiter = new RateLimiter(30, 60_000);

/**
 * Quem pode consumir as APIs geo (que têm custo por chamada):
 * - Produção: pessoa autenticada com acesso à operação.
 * - Demo: aberto, porém limitado por IP (30 req/min por instância).
 */
export async function authorizeGeoRequest(): Promise<{ ok: true; clientKey: string } | { ok: false; status: number; error: string }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";

  let clientKey = `ip:${ip}`;
  if (getAppMode() === "production") {
    const session = await resolveSession();
    if (session.status !== "ok") return { ok: false, status: 401, error: "Sessão necessária." };
    if (!can(session.actor, "operation:read")) return { ok: false, status: 403, error: "Sem acesso ao mapa operacional." };
    clientKey = `user:${session.actor.userId}`;
  }
  if (!limiter.allow(clientKey)) return { ok: false, status: 429, error: "Muitas requisições. Aguarde um instante." };
  return { ok: true, clientKey };
}
