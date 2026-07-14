import { NextResponse } from "next/server";

import { exigirUsuarioAtivo } from "@/server/auth";
import { listarPropostas } from "@/server/propostas";
import { podeVerHistoricoDeTodos } from "@/domain/auth/types";
import { responderErro } from "@/app/api/_lib/responder";
import { filtrosDaUrl } from "@/app/api/_lib/filtros";

export const runtime = "nodejs";

/** Clientes atendidos. Vendedor vê só os seus; admin/gestor veem todos. */
export async function GET(request: Request) {
  try {
    const ator = await exigirUsuarioAtivo();
    const f = filtrosDaUrl(new URL(request.url));

    const restricao = podeVerHistoricoDeTodos(ator.papel) ? null : ator.id;

    const propostas = await listarPropostas(
      {
        de: f.de,
        ate: f.ate,
        vendedorId: f.vendedorId,
        instituicao: f.instituicao,
        busca: f.busca,
      },
      restricao,
    );

    return NextResponse.json({ propostas });
  } catch (erro) {
    return responderErro(erro);
  }
}
