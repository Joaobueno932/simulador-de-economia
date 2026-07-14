import { NextResponse, type NextRequest } from "next/server";

/**
 * Primeira barreira: sem cookie de sessão, nem chega às páginas.
 *
 * IMPORTANTE: isto é só conveniência de navegação — o middleware roda no Edge e
 * não consulta o banco, então ele confere apenas a PRESENÇA do cookie, não a
 * validade dele. Quem de fato autoriza é o servidor, em cada página e rota de
 * API (`exigirSessao`). Um cookie forjado passa aqui e morre lá.
 */

const COOKIE_SESSAO = "em_conta_sessao";

/** Rotas públicas — todo o resto exige sessão. */
const PUBLICAS = ["/login", "/api/auth/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const temCookie = Boolean(request.cookies.get(COOKIE_SESSAO)?.value);

  if (!publica && !temCookie) {
    // API responde 401; página redireciona para o login.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("de", pathname);
    return NextResponse.redirect(url);
  }

  // Já logado não precisa ver a tela de login.
  if (pathname === "/login" && temCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Tudo, menos estáticos e imagens.
  matcher: ["/((?!_next/static|_next/image|img/|favicon.ico).*)"],
};
