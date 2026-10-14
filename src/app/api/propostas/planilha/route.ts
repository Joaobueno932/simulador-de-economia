import { NextResponse } from "next/server";

import { buscarUsuario } from "@/server/usuarios";
import { exigirUsuarioAtivo } from "@/server/auth";
import { listarPropostas } from "@/server/propostas";
import { podeVerHistoricoDeTodos } from "@/domain/auth/types";
import {
  MIME_XLSM,
  montarPlanilhaDeClientes,
  nomeArquivoDeClientes,
} from "@/server/planilha/clientes";
import { filtrosDaUrl } from "@/app/api/_lib/filtros";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

/**
 * Exporta a aba "Clientes atendidos" em .xlsm.
 *
 * Mesmos filtros e MESMA regra de acesso da listagem (`GET /api/propostas`):
 * vendedor exporta só as propostas no nome dele; admin/gestor exportam todas.
 * Um arquivo é fácil de reenviar, então aqui a trava não pode ser mais frouxa
 * que a da tela.
 */
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
        // A tela mostra 200; o arquivo é o registro do período, e vale levar
        // tudo o que o filtro alcança.
        limite: 5000,
      },
      restricao,
    );

    // O nome do vendedor, para constar no cabeçalho da planilha em vez do id.
    const vendedor = f.vendedorId ? await buscarUsuario(f.vendedorId) : null;

    const agora = new Date();
    const planilha = montarPlanilhaDeClientes({
      propostas,
      filtros: {
        de: f.de,
        ate: f.ate,
        vendedor: vendedor?.nome ?? null,
        instituicao: f.instituicao,
        busca: f.busca,
      },
      geradaPor: ator.nome,
      geradaEm: agora,
      origem: origemDe(request),
    });

    const arquivo = nomeArquivoDeClientes(agora);

    return new NextResponse(planilha as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": MIME_XLSM,
        // `attachment`: aqui o gestor está baixando, não conferindo na tela.
        "Content-Disposition": `attachment; filename="${arquivo}"`,
        "Content-Length": String(planilha.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (erro) {
    return responderErro(erro);
  }
}

/**
 * A origem pública do app, para montar o link do PDF dentro da planilha.
 *
 * Atrás de proxy (Vercel, nginx) a URL que chega ao handler é a interna — daí
 * preferir os cabeçalhos `x-forwarded-*`, que carregam o host que o navegador
 * de fato usou. Sem eles, vale a URL da requisição.
 */
function origemDe(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return new URL(request.url).origin;

  const protocolo =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    new URL(request.url).protocol.replace(":", "");

  return `${protocolo}://${host}`;
}
