import { NextResponse, type NextRequest } from "next/server";

// Checagem otimista de sessão (Next 16: proxy.ts substitui middleware.ts).
// A autorização de verdade acontece no servidor, em cada layout e server
// action (lib/server/session.ts). Aqui só evitamos renderizar páginas
// protegidas para quem claramente não tem sessão.

const PUBLIC_PREFIXES = ["/auth", "/api/auth", "/acesso-pendente"];

export async function proxy(request: NextRequest) {
  if (process.env.ORBITA_MODE !== "production") return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");
  if (process.env.ORBITA_AUTH_PROVIDER === "dev") {
    if (request.cookies.has("orbita_dev_session")) return NextResponse.next();
    return isApi
      ? NextResponse.json({ error: "Sessão necessária." }, { status: 401 })
      : NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }
  // APIs validam a sessão no próprio handler e respondem 401 (sem redirecionar).
  if (isApi) return NextResponse.next();

  const { getNeonAuth } = await import("./lib/auth/neon");
  return getNeonAuth().middleware({ loginUrl: "/auth/sign-in" })(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico|webp)$).*)"],
};
