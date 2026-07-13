/**
 * POST /api/proposta/pdf
 *
 * Recebe APENAS as entradas da simulação. O servidor:
 *   1. valida com o mesmo schema Zod do formulário;
 *   2. RECALCULA tudo do zero (nada de confiar em número vindo do navegador);
 *   3. renderiza a proposta e devolve o PDF.
 */

import { NextResponse } from "next/server";

import { calcularSimulacao } from "@/domain/simulator/calculations";
import { nomeArquivoProposta } from "@/domain/simulator/format";
import { simulacaoSchema } from "@/domain/simulator/validation";
import { gerarPdfProposta } from "@/server/pdf";

export const runtime = "nodejs";
/** O Chromium leva alguns segundos para subir na primeira chamada. */
export const maxDuration = 60;

export async function POST(request: Request) {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parse = simulacaoSchema.safeParse(corpo);
  if (!parse.success) {
    // Devolve só a mensagem e o campo — nunca ecoa os dados pessoais recebidos.
    const problemas = parse.error.issues.map((i) => ({
      campo: i.path.join("."),
      mensagem: i.message,
    }));
    return NextResponse.json(
      { erro: "Dados da simulação inválidos.", problemas },
      { status: 400 },
    );
  }

  const simulacao = parse.data;

  try {
    // Recálculo no servidor — a fonte de verdade dos números do PDF.
    const resultado = calcularSimulacao(simulacao);
    const pdf = await gerarPdfProposta(simulacao.cliente, resultado);

    const arquivo = nomeArquivoProposta(simulacao.cliente.nome, simulacao.cliente.dataProposta);

    return new NextResponse(pdf as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${arquivo}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (erro) {
    // Loga só o motivo técnico — sem nome, documento ou telefone do cliente.
    console.error(
      "Falha ao gerar o PDF da proposta:",
      erro instanceof Error ? erro.message : "erro desconhecido",
    );
    return NextResponse.json(
      { erro: "Não foi possível gerar o PDF. Tente novamente." },
      { status: 500 },
    );
  }
}
