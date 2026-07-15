import { NextResponse } from "next/server";

import { exigirUsuarioAtivo } from "@/server/auth";
import { registrarEvento } from "@/server/eventos";
import { buscarSimulacao, excluirSimulacao } from "@/server/simulacoes";
import { ErroDeNegocio } from "@/server/usuarios";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

function idDe(valor: string): number {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new ErroDeNegocio("Cliente inválido.");
  return id;
}

/** Reabre um cliente salvo: devolve a simulação para carregar no simulador. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ator = await exigirUsuarioAtivo();
    const { id } = await params;
    const simulacao = await buscarSimulacao(ator, idDe(id));
    return NextResponse.json({ simulacao });
  } catch (erro) {
    return responderErro(erro);
  }
}

/** Exclui um cliente salvo. Só admin/gestor — a trava está em `excluirSimulacao`. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ator = await exigirUsuarioAtivo();
    const { id } = await params;

    const clienteNome = await excluirSimulacao(ator, idDe(id));

    await registrarEvento({
      usuarioId: ator.id,
      tipo: "cliente_excluido",
      descricao: `Excluiu o cliente salvo ${clienteNome || "(sem nome)"}`,
    });

    return NextResponse.json({ ok: true });
  } catch (erro) {
    return responderErro(erro);
  }
}
