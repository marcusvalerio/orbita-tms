import { getAppMode, getIdentityProviderKind } from "@/lib/config/runtime";
import { getNeonAuth } from "@/lib/auth/neon";

// Proxy da API do Neon Auth (sessão, callbacks OAuth, verificação de e-mail).
// Inexistente fora do Modo Produção com Neon Auth.

function unavailable() {
  return Response.json({ error: "Autenticação indisponível neste modo." }, { status: 404 });
}

type Handler = (req: Request, ctx: { params: Promise<{ path: string[] }> }) => Promise<Response>;

function handlers(): { GET: Handler; POST: Handler } | null {
  if (getAppMode() !== "production" || getIdentityProviderKind() !== "neon") return null;
  return getNeonAuth().handler() as unknown as { GET: Handler; POST: Handler };
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const h = handlers();
  return h ? h.GET(req, ctx) : unavailable();
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const h = handlers();
  return h ? h.POST(req, ctx) : unavailable();
}
