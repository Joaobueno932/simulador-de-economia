import { NextResponse } from "next/server";

import { exigirUsuarioAtivo } from "@/server/auth";
import { buscarPropostaParaPdf } from "@/server/propostas";
import { ErroDeNegocio } from "@/server/usuarios";
import { gerarPdfProposta } from "@/server/pdf";
import { calcularSimulacao } from "@/domain/simulator/calculations";
import { nomeArquivoProposta } from "@/domain/simulator/format";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Reabre o PDF de uma proposta já emitida.
 *
 * O PDF é REGERADO a partir das entradas e da configuração congeladas na linha —
 * não guardamos os bytes. Como a config vai junto, o documento sai com os mesmos
 * números de quando foi emitido, mesmo que a tarifa tenha mudado depois.
 *
 * Quem pode ver: admin/gestor veem tudo; vendedor vê só as propostas no nome dele.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ator = await exigirUsuarioAtivo();

    const { id } = await params;
    const propostaId = Number(id);
    if (!Number.isInteger(propostaId) || propostaId <= 0) {
      throw new ErroDeNegocio("Proposta inválida.");
    }

    // A permissão é conferida dentro de `buscarPropostaParaPdf`.
    const proposta = await buscarPropostaParaPdf(ator, propostaId);

    const resultado = calcularSimulacao(proposta.simulacao, proposta.configuracao);
    const pdf = await gerarPdfProposta(
      proposta.simulacao.cliente,
      resultado,
      proposta.configuracao,
    );

    const arquivo = nomeArquivoProposta(
      proposta.simulacao.cliente.nome,
      proposta.simulacao.cliente.dataProposta,
    );

    return new NextResponse(pdf as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // `inline`: o gestor está conferindo, não baixando um lote.
        "Content-Disposition": `inline; filename="${arquivo}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (erro) {
    return responderErro(erro);
  }
}
