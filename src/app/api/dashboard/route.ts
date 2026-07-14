import { NextResponse } from "next/server";

import { exigirUsuarioAtivo } from "@/server/auth";
import { exigirAcessoAoDashboard, montarDashboard } from "@/server/propostas";
import { responderErro } from "@/app/api/_lib/responder";
import { filtrosDaUrl } from "@/app/api/_lib/filtros";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const ator = await exigirUsuarioAtivo();
    exigirAcessoAoDashboard(ator);

    const filtro = filtrosDaUrl(new URL(request.url));
    return NextResponse.json({ dashboard: await montarDashboard(filtro) });
  } catch (erro) {
    return responderErro(erro);
  }
}
