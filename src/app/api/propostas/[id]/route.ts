import { NextResponse } from "next/server";

import { exigirUsuarioAtivo } from "@/server/auth";
import { registrarEvento } from "@/server/eventos";
import { excluirProposta } from "@/server/propostas";
import { ErroDeNegocio } from "@/server/usuarios";
import { responderErro } from "@/app/api/_lib/responder";

export const runtime = "nodejs";

/**
 * Remove uma proposta do histórico (limpeza de testes).
 *
 * Só admin/gestor — a permissão é conferida em `excluirProposta`. A exclusão
 * fica registrada: some a proposta, mas não some o rastro de que alguém a
 * removeu.
 */
export async function DELETE(
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

    const clienteNome = await excluirProposta(ator, propostaId);

    await registrarEvento({
      usuarioId: ator.id,
      tipo: "proposta_excluida",
      descricao: `Removeu do histórico a proposta de ${clienteNome}`,
    });

    return NextResponse.json({ ok: true });
  } catch (erro) {
    return responderErro(erro);
  }
}
