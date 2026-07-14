import { NextResponse } from "next/server";

import { exigirUsuarioAtivo } from "@/server/auth";
import { listarEventos } from "@/server/eventos";
import type { TipoEvento } from "@/domain/auth/eventos";
import { podeVerHistoricoDeTodos } from "@/domain/auth/types";
import { responderErro } from "@/app/api/_lib/responder";
import { filtrosDaUrl } from "@/app/api/_lib/filtros";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const ator = await exigirUsuarioAtivo();
    const f = filtrosDaUrl(new URL(request.url));

    // Vendedor só enxerga a própria trilha — a trava é aqui, no servidor, não no
    // filtro que a tela mandou.
    const restricao = podeVerHistoricoDeTodos(ator.papel) ? null : ator.id;

    const eventos = await listarEventos(
      {
        de: f.de,
        ate: f.ate,
        usuarioId: f.vendedorId,
        tipo: (f.tipo as TipoEvento | null) ?? null,
        instituicao: f.instituicao,
      },
      restricao,
    );

    return NextResponse.json({ eventos });
  } catch (erro) {
    return responderErro(erro);
  }
}
